from django.shortcuts import render,redirect,get_object_or_404
from .forms import PromotionForm, EditPromotionForm, ScheduleForm, PromotionImageForm
from django.contrib import messages
import core.custom_messages as custom_messages
from .models import Promotion , PromotionImage, get_default_value_to_theme
from django.contrib.auth import get_user_model
from django.template.loader import render_to_string
from django.http import JsonResponse
from datetime import datetime
from django.db import transaction
from django.urls import reverse
from urllib.parse import quote, unquote
import logging

logger = logging.getLogger(__name__)
from .helper import image_to_base64, update_wheel_colors
from .helper import check_script
import json
import os
from urllib.parse import urlparse
import logging
from google.oauth2 import service_account
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
logger = logging.getLogger(__name__)


def _sync_popup_settings_dimensions_from_container(theme):
    """Copy containerStyle width/height into popup_settings when missing.

    New promotions start from get_default_value_to_theme(), whose popup_settings
    has no popup_width/popup_height; dimensions live only on containerStyle until
    the editor syncs. That mismatch breaks layout after reload.
    """
    if not isinstance(theme, dict):
        return
    cs = theme.get("containerStyle")
    if not isinstance(cs, dict):
        return
    ps = theme.setdefault("popup_settings", {})
    if not isinstance(ps, dict):
        theme["popup_settings"] = {}
        ps = theme["popup_settings"]

    def _norm(val):
        if val is None:
            return None
        s = str(val).strip()
        return s or None

    w, h = _norm(cs.get("width")), _norm(cs.get("height"))
    if w and not ps.get("popup_width"):
        ps["popup_width"] = w
    if h and not ps.get("popup_height"):
        ps["popup_height"] = h


def _get_app_user(request):
    if request.user.is_authenticated:
        return request.user

    User = get_user_model()
    user = User.objects.order_by("id").first()
    if user:
        return user

    return User.objects.create_user(
        username="local-owner",
        email="local-owner@example.com",
        password=None,
    )


def promotions(request):
    return render(request,"promotions.html",locals())

def new_promotion(request):
    app_user = _get_app_user(request)
    if request.GET.get('user') and request.GET.get('website'):
        # Deep link with user + website: go to template selection
        name = request.GET.get('name')
        website = request.GET.get('website')
        if name and website:
            return redirect(f"/promotion/select-template?name={quote(name)}&website={quote(website)}")
        else:
            return render(request, "new.html", locals())

    if request.method == "POST":
        post_data = request.POST.copy()
        post_data["user"] = app_user.pk
        form = PromotionForm(post_data)
        name = request.POST.get('name')
        website = request.POST.get('website')

        if form.is_valid():
            if name and website:
                return redirect(f"/promotion/select-template?name={quote(name)}&website={quote(website)}")
            promotion = form.save()
            edit_url = reverse("promotion_edit", kwargs={"pk": promotion.pk})
            return redirect(edit_url)
        else:
            return render(request, "new.html", locals())
    else:
        form = PromotionForm(initial={"user": app_user})
    return render(request, "new.html", locals())

def select_promotion_template(request, pk=None):
    app_user = _get_app_user(request)
    promotion = get_object_or_404(Promotion, pk=pk, user=app_user) if pk else None

    def parse_template_payload(raw_payload):
        if not raw_payload:
            return {}
        try:
            return json.loads(raw_payload)
        except json.JSONDecodeError:
            try:
                return json.loads(unquote(raw_payload))
            except json.JSONDecodeError as parse_error:
                logger.warning("Failed to parse template payload: %s", parse_error)
                return {}

    def apply_template_to_theme(selected_template_id, template_data, existing_theme=None):
        theme = existing_theme or get_default_value_to_theme()
        theme["template"] = selected_template_id
        theme["popup_type"] = "gaming"

        direct_copy_keys = (
            "containerStyle", "layout", "text_styles", "close_button",
            "input_fields", "input_fields_style",
            "mobile_style", "game_styles", "content_styles", "image_styles"
        )
        for key in direct_copy_keys:
            if template_data.get(key) is not None:
                theme[key] = template_data[key]

        if template_data.get("texts") is not None:
            theme["texts"] = dict(template_data["texts"])

        for image_key in ("background_image", "image", "top_image", "bottom_image"):
            image_data = template_data.get(image_key)
            if image_data is not None:
                theme[image_key] = image_data

        legacy_gs = template_data.get("game_svg")
        if template_data.get("gameID") is not None:
            theme["gameID"] = template_data["gameID"]

        if template_data.get("gameColors") is not None:
            theme["gameColors"] = dict(template_data["gameColors"]) if isinstance(template_data.get("gameColors"), dict) else {}

        # New system: desktop_style backend'de asla saklanmaz.
        theme.pop("desktop_style", None)
        for _legacy in ("game_svg", "wheel", "slotmachine", "scratchcard"):
            theme.pop(_legacy, None)

        theme.pop("gameSVG", None)

        if isinstance(template_data.get("popup_settings"), dict):
            ps = theme.setdefault("popup_settings", {})
            for k, v in template_data["popup_settings"].items():
                if v is not None:
                    ps[k] = v

        if isinstance(template_data.get("rewards"), list):
            theme["rewards"] = [
                dict(r) if isinstance(r, dict) else r for r in template_data["rewards"]
            ]

        _sync_popup_settings_dimensions_from_container(theme)

        return theme

    if request.method == "POST":
        raw_template_id = request.POST.get("template_id", "").strip()
        template_theme_data_json = request.POST.get("template_theme_data")
        name = request.POST.get("name") or (promotion.name if promotion else None)
        website = request.POST.get("website") or (promotion.website if promotion else None)
        
        if not name or not website:
            messages.error(request, "Name and website are required.")
            redirect_url = "promotion_select_template" if promotion else "new-promotion"
            return redirect(redirect_url, pk=promotion.pk) if promotion else redirect(redirect_url)
        
        if not raw_template_id:
            return redirect("promotion_edit", pk=promotion.pk) if promotion else redirect("new-promotion")
        
        try:
            template_id = int(raw_template_id)
        except (ValueError, TypeError):
            template_id = 101

        template_data = parse_template_payload(template_theme_data_json)

        if not promotion:
            promotion = Promotion.objects.create(
                user=app_user,
                name=name,
                website=website,
                theme=get_default_value_to_theme(),
            )
            messages.success(request, "Promotion created successfully.")

            updated_theme = apply_template_to_theme(template_id, template_data, promotion.theme)
            promotion.theme = updated_theme
            promotion.save(update_fields=["theme"])
        
        edit_url = reverse("promotion_edit", kwargs={"pk": promotion.pk})
        return redirect(f"{edit_url}?template_id={template_id}")

    context = {
        "categories": ["Wheel"],
    }
    
    if promotion:
        context["promotion"] = promotion
        template_id = (promotion.theme or {}).get('template', '')
        context["current_popup_type"] = "gaming"
        context["current_template_id"] = template_id
    else:
        context["promotion_name"] = request.GET.get('name', '')
        context["promotion_website"] = request.GET.get('website', '')
        context["current_popup_type"] = 'gaming'  # Default for new promotions
    
    return render(request, "promotion_template_select.html", context)

def _serialize_form_errors_to_messages(form):
    """Django ValidationError.code → istemci (accordion / alan vurgusu)."""
    out = []
    if not form.errors:
        return out
    for field, error_list in form.errors.as_data().items():
        for ve in error_list:
            msg = ve.messages[0] if ve.messages else str(ve)
            out.append(
                {
                    "field": field,
                    "error": msg,
                    "code": getattr(ve, "code", None) or "",
                }
            )
    return out


def edit_promotion(request, pk):
    app_user = _get_app_user(request)
    # Retrieve the promotion to be edited
    promotion = get_object_or_404(Promotion, pk=pk)
    if promotion.user != app_user:
        if hasattr(request, "_messages"):
            messages.warning(request, "You do not have permission to access this promotion.")
        return render(request, "permission_denied.html", status=403)

    if request.method == 'POST':
        # If the request is a POST, process the form data
        base_form = EditPromotionForm(request.POST, instance=promotion)
        schedule_form = ScheduleForm(request.POST, instance=promotion)

        if base_form.is_valid() and schedule_form.is_valid():
            # If both forms are valid, save the updated promotion and set success to True
            with transaction.atomic():
                base_form.save()
                # Check the schedule form and handle NULL assignment
                schedule_instance = schedule_form.save(commit=False)
                theme = schedule_form.cleaned_data.get("theme")

                if theme and not theme.get("schedule"):
                    schedule_instance.start_date = None
                    schedule_instance.start_time = None
                    schedule_instance.end_date = None
                    schedule_instance.end_time = None

                # Save schedule form data
                schedule_instance.save()
            return JsonResponse({"success": True, "messages": []})
        else:
            errors = _serialize_form_errors_to_messages(base_form) + _serialize_form_errors_to_messages(
                schedule_form
            )
            return JsonResponse({"success": False, "messages": errors}, safe=False)

    else:
        # For a GET request, instantiate the forms with the existing promotion data
        base_form = EditPromotionForm(instance=promotion)
        schedule_form = ScheduleForm(instance=promotion)


    # Render the template with the forms and promotion data
    template_id_param = request.GET.get('template_id', '')

    return render(request, 'promotion.html', {
        'base_form': base_form,
        'schedule_form': schedule_form,
        'promotion': promotion,
        'template_id_param': template_id_param,
    })

def delete_promotion(request, pk):
    app_user = _get_app_user(request)
    # Retrieve the promotion to be deleted
    promotion = get_object_or_404(Promotion, pk=pk)
    if promotion.user != app_user:
        if hasattr(request, "_messages"):
            messages.warning(request, "You do not have permission to access this promotion.")
        return render(request, "permission_denied.html", status=403)

    promotion.delete()

    return redirect('/')

def install_promotion(request,pk):
    app_user = _get_app_user(request)
    # Retrieve the promotion to be installed
    promotion = get_object_or_404(Promotion, pk=pk)
    if promotion.user != app_user:
        if hasattr(request, "_messages"):
            messages.warning(request, "You do not have permission to access this promotion.")
        return render(request, "permission_denied.html", status=403)
    
    link = f"{settings.CDN_URL}/widget.js"
    domain = promotion.website
    
    return render(request, "install.html", locals())

def check_install(request):
    if request.method == "POST":
        domain = request.POST.get("domain")

        # Add "http://" prefix if not present
        if not domain.startswith(("http://", "https://")):
            domain = "https://" + domain


        script_exists = check_script(domain)
        message = "Setup is successful" if script_exists else "Oops, script not found. Please check manually."

        # JSON response for AJAX request
        return JsonResponse({'script_exists': script_exists, 'message': message})

    # Sayfa ilk yüklendiğinde GET isteği ile render edilir
    return render(request, "install.html")

def upload_image(request, pk):
    app_user = _get_app_user(request)
    promotion = get_object_or_404(Promotion, pk=pk)
    if promotion.user != app_user:
        return JsonResponse(
            {"success": False, "error": "You do not have permission to access this promotion."},
            status=403,
        )
    if request.method == 'POST':
        form = PromotionImageForm(request.POST, request.FILES)
        if form.is_valid():
            uploaded_image = request.FILES.get('image')
            if uploaded_image:
                if uploaded_image.size > 1 * 1024 * 1024:
                    return JsonResponse({'success': False, 'error': 'Image size cannot exceed 1MB.'})

                allowed_types = ['image/jpeg', 'image/png','image/jpg','image/webp','image/gif','image/svg+xml']
                if uploaded_image.content_type not in allowed_types:
                    return JsonResponse({'success': False, 'error': 'Only JPEG, PNG, JPG, WEBP, GIF, SVG formats are allowed.'})

            usage = (request.POST.get('usage') or PromotionImage.Usage.TOP).strip().lower()
            if usage not in (PromotionImage.Usage.TOP, PromotionImage.Usage.POPUP_BG):
                usage = PromotionImage.Usage.TOP
            if usage == PromotionImage.Usage.POPUP_BG:
                existing_bg = PromotionImage.objects.filter(
                    promotion=promotion, usage=PromotionImage.Usage.POPUP_BG
                ).count()
                if existing_bg >= 5:
                    return JsonResponse(
                        {
                            'success': False,
                            'error': 'You can save at most 5 popup background images.',
                        }
                    )

            image = form.save(commit=False)
            image.promotion = promotion
            image.usage = usage
            image.save()
            return JsonResponse({'success': True, 'image_id': image.pk, 'image_url': image.image.url})
        else:

            errors = {field: error[0] for field, error in form.errors.items()}
            messages.error(request, "Form validation failed.")
            return JsonResponse({'success': False, 'errors': errors})
    return JsonResponse({'success': False, 'error': 'Invalid request method.'})

def delete_image(request, pk, image_id):
    app_user = _get_app_user(request)
    promotion = get_object_or_404(Promotion, pk=pk)
    if promotion.user != app_user:
        return JsonResponse(
            {"success": False, "error": "You do not have permission to access this promotion."},
            status=403,
        )
    image = get_object_or_404(PromotionImage, pk=image_id, promotion_id=pk)
    image_path = image.image.path
    image.delete()
    if os.path.exists(image_path):
        os.remove(image_path)
    return JsonResponse({'success': True})

