from django.shortcuts import render
from django.contrib.auth import get_user_model
from types import SimpleNamespace
from promotion.reports import get_awards_report, get_conversion_rates


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


def home(request):
    # for welcoming message
    initial_str = request.GET.get("initial")
    initial = True if initial_str and initial_str == "true" else False

    app_user = _get_app_user(request)
    active_subscription = SimpleNamespace(left_credit=0, credit_level="N/A")

    promotions = app_user.promotions.all().order_by("-id")

    awards = get_awards_report(app_user)

    conversion_rates = get_conversion_rates(app_user)

    activation_url = None

    return render(request, "home.html", locals())

# @login_required
# def help(request):
#     return render(request, "help/help.html")
