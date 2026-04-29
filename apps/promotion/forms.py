import re

from django import forms
from .models import Promotion, PromotionImage
from core.forms import BaseForm
import json
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.core.validators import URLValidator
from .models import get_default_value_to_theme

_CONSENT_POLICY_SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*:")


def _find_consent_input_field(theme):
    if not isinstance(theme, dict):
        return None
    fields = theme.get("input_fields")
    if not isinstance(fields, list):
        return None
    for f in fields:
        if isinstance(f, dict) and f.get("type") == "consent":
            return f
    return None


def _normalize_consent_policy_url(raw):
    s = (raw or "").strip()
    if not s:
        return ""
    if not _CONSENT_POLICY_SCHEME_RE.match(s):
        return f"https://{s}"
    return s


def _theme_applies_reward_weight_total_rule(theme):
    """
    Weight (%) toplamının 100 olması kuralı yalnızca gaming popup'larda uygulanır.
    """
    if not isinstance(theme, dict):
        return False
    return str(theme.get("popup_type") or "").lower() == "gaming"


def _reward_entry_is_active_for_validation(entry):
    """Yeni istemci `hasReward`; eski kayıtlarda yalnızca weight > 0."""
    if not isinstance(entry, dict):
        return False
    if "hasReward" in entry:
        return bool(entry.get("hasReward"))
    try:
        w = int(entry.get("weight", 0))
    except (TypeError, ValueError):
        return False
    return w > 0


def _normalize_reward_weight_value(value):
    """0–100 arası tam sayı; metinde harf, boşluk, eksi veya ondalık yok."""
    if value is None:
        return 0
    if isinstance(value, bool):
        raise ValidationError(
            "Reward weight must be a whole number between 0 and 100.",
            code="reward_weight_invalid",
        )
    if isinstance(value, int):
        if value < 0 or value > 100:
            raise ValidationError(
                "Each reward weight must be between 0 and 100.",
                code="reward_weight_range",
            )
        return value
    if isinstance(value, float):
        if not value.is_integer():
            raise ValidationError(
                "Reward weight must be a whole number between 0 and 100.",
                code="reward_weight_invalid",
            )
        iv = int(value)
        if iv < 0 or iv > 100:
            raise ValidationError(
                "Each reward weight must be between 0 and 100.",
                code="reward_weight_range",
            )
        return iv
    s = str(value).strip()
    if s == "":
        return 0
    if not re.fullmatch(r"[0-9]+", s):
        raise ValidationError(
            "Reward weight must be a whole number between 0 and 100 "
            "(no letters, spaces, or minus sign).",
            code="reward_weight_invalid",
        )
    w = int(s)
    if w > 100:
        raise ValidationError(
            "Each reward weight cannot exceed 100.",
            code="reward_weight_range",
        )
    return w


def _promotion_name_field():
    return forms.CharField(
        label="Name",
        max_length=30,
        min_length=1,
        required=True,
        strip=True,
        error_messages={
            "required": "Please enter a promotion name.",
            "max_length": (
                f"Promotion name must be {30} characters or fewer."
            ),
            "min_length": "Please enter at least one character for the promotion name.",
        },
        widget=forms.TextInput(
            attrs={
                "maxlength": str(30),
                "minlength": "1",
            }
        ),
    )


class PromotionForm(BaseForm):
    name = _promotion_name_field()

    class Meta:
        model = Promotion
        fields = ("user", "name", "website",)
        widgets = {'user': forms.HiddenInput()}

    def clean_website(self):
        value = self.cleaned_data.get('website')

        # Remove http:// or https:// if present
        value = value.replace('http://', '').replace('https://', '')

        user = self.cleaned_data.get('user')

        if Promotion.objects.filter(website=value).exclude(user=user).exists():
            raise ValidationError("This website has already been added by another user.")

        return value

class EditPromotionForm(BaseForm):
    name = _promotion_name_field()

    class Meta:
        model = Promotion
        fields = ("name","website","is_active","theme","start_date","start_time","end_date","end_time")
        widgets = {'theme': forms.HiddenInput()}

    def clean_theme(self):
        def is_valid_url(url):
            validator = URLValidator()
            try:
                validator(url)
                return True
            except ValidationError:
                return False

        theme = self.cleaned_data.get("theme")

        # Consent: yalnızca `input_fields` içinde `type: consent` (policy_url). options'a yazılmaz.
        consent_field = _find_consent_input_field(theme)
        if consent_field is not None:
            raw_link = str(consent_field.get("policy_url") or "").strip()
            if raw_link == "":
                raise forms.ValidationError(
                    "Privacy / policy URL cannot be empty when the consent checkbox is enabled.",
                    code="consent_policy_url_blank",
                )
            normalized = _normalize_consent_policy_url(raw_link)
            if not is_valid_url(normalized):
                raise forms.ValidationError(
                    "Enter a valid URL (for example https://example.com/privacy).",
                    code="consent_policy_url_invalid",
                )
            consent_field["policy_url"] = normalized

        # Check countdown valid time should be greater than 0
        if theme["countdown"]["active"]:
            valid_time = theme["countdown"].get("valid_time", "").strip()

            if valid_time == "":
                raise forms.ValidationError("If the countdown reminder is active, the valid time field cannot be left blank")

            try:
                valid_time_value = int(valid_time)
            except ValueError:
                raise forms.ValidationError("The valid time must be a valid number")

            if valid_time_value < 0:
                raise forms.ValidationError("The valid time cannot be a negative number")

        # Check start delay should be greater than 0
        if theme["options"]["start_delay_active"]:
            start_delay = theme["options"].get("start_delay", "").strip()

            if start_delay == "":
                raise forms.ValidationError("If the start delay option is active, the Start delay field cannot be left blank")

            try:
                start_delay_value = int(start_delay)
            except ValueError:
                raise forms.ValidationError("The start delay must be a valid number")

            if start_delay_value < 0:
                raise forms.ValidationError("The start delay cannot be a negative number")

        opts = theme.get("options")
        if isinstance(opts, dict) and opts.get("smart_reward"):
            prop = str(opts.get("property_id", "") or "").strip()
            if not prop:
                raise forms.ValidationError(
                    "If the Ai powered triggers is active, the property id field cannot be left empty",
                )

        texts = theme.get("texts")
        if isinstance(texts, dict):
            texts.pop("submit_button", None)
            texts.pop("close_link", None)

        for f in theme.get("input_fields") or []:
            if not isinstance(f, dict):
                continue
            if f.get("type") not in ("submit_button", "button"):
                continue
            if not str(f.get("text", "") or "").strip():
                raise forms.ValidationError(
                    "Button text cannot be empty. Please enter text for each button."
                )

        # Ödüller: tek kaynak `code`; eski istemciler `couponCode` gönderebilir.
        REWARD_LABEL_MAX_LEN = 14
        rewards = theme.get("rewards")
        if isinstance(rewards, list):
            for item in rewards:
                if not isinstance(item, dict):
                    continue
                item["weight"] = _normalize_reward_weight_value(item.get("weight", 0))
                code = item.get("code")
                if code is None or code == "":
                    alt = item.get("couponCode")
                    if alt is not None:
                        item["code"] = str(alt).strip()
                else:
                    item["code"] = str(code).strip()
                for lbl_key in ("label", "text"):
                    if lbl_key not in item or item[lbl_key] is None:
                        continue
                    s = str(item[lbl_key]).strip()
                    if len(s) > REWARD_LABEL_MAX_LEN:
                        item[lbl_key] = s[:REWARD_LABEL_MAX_LEN]

            MIN_ACTIVE_REWARDS = 3
            opts = theme.get("options")
            if (
                len(rewards) >= MIN_ACTIVE_REWARDS
                and isinstance(opts, dict)
                and not opts.get("smart_reward")
            ):
                active_n = sum(
                    1 for item in rewards if _reward_entry_is_active_for_validation(item)
                )
                if active_n < MIN_ACTIVE_REWARDS:
                    raise forms.ValidationError(
                        "At least three rewards must remain active.",
                        code="rewards_min_active",
                    )

            if (
                _theme_applies_reward_weight_total_rule(theme)
                and isinstance(opts, dict)
                and not opts.get("smart_reward")
                and len(rewards) > 0
            ):
                total_weight = sum(
                    int(item.get("weight", 0))
                    for item in rewards
                    if isinstance(item, dict)
                )
                if total_weight != 100:
                    raise forms.ValidationError(
                        "Reward weights must add up to exactly 100%.",
                        code="reward_weights_sum_100",
                    )

        if isinstance(theme.get("options"), dict):
            theme["options"].pop("display_consent", None)
            theme["options"].pop("consent_link", None)

        # Oyun gövdesi kalıcı tutulmaz; render gameID ile yüklenir.
        theme.pop("gameSVG", None)

        return theme

    def clean_website(self):
        value = self.cleaned_data.get('website')

        # Remove http:// or https:// if present
        value = value.replace('http://', '').replace('https://', '')

        user = self.instance.user

        if Promotion.objects.filter(website=value).exclude(user=user).exists():
            raise ValidationError("This website has already been added by another user.")

        return value

class ScheduleForm(BaseForm):
    start_date = forms.DateField(widget=forms.DateInput(attrs={'type': 'date'}), required=False)
    start_time = forms.TimeField(widget=forms.TimeInput(attrs={'type': 'time'}), required=False)
    end_date = forms.DateField(widget=forms.DateInput(attrs={'type': 'date'}), required=False)
    end_time = forms.TimeField(widget=forms.TimeInput(attrs={'type': 'time'}), required=False)

    class Meta:
        model = Promotion
        fields = ['start_date', 'start_time', 'end_date', 'end_time','theme']

    def clean(self):
        cleaned_data = super().clean()
         # Check Schedule start date and end date inputs
        start_date = cleaned_data.get('start_date')
        start_time = cleaned_data.get('start_time')
        end_date = cleaned_data.get('end_date')
        end_time = cleaned_data.get('end_time')
        theme = self.cleaned_data.get("theme")

        if theme["schedule"]==True:
            # If the schedule feature is set, all date and time fields must be entered.
            if not start_date:
                self.add_error('start_date', "Start date is required when schedule is enabled.")
            if not start_time:
                self.add_error('start_time', "Start time is required when schedule is enabled.")
            if not end_date:
                self.add_error('end_date', "End date is required when schedule is enabled.")
            if not end_time:
                self.add_error('end_time', "End time is required when schedule is enabled.")

            # Only proceed with date/time comparisons if we have all required values
            if all([start_date, end_date, start_time, end_time]):
                # Dates must be entered correctly
                if start_date and start_date < timezone.now().date():
                    self.add_error('start_date', "Start date cannot be in the past.")
                elif end_date and end_date < timezone.now().date():
                    self.add_error('end_date', "End date cannot be in the past.")
                elif start_date and end_date and start_date > end_date:
                    self.add_error("end_date", "End date must be after start date.")
                elif start_date == end_date and start_time > end_time:
                    self.add_error("end_time", "End time must be after start time.")

        return cleaned_data

    def get_start_datetime(self, cleaned_data):
        start_date = cleaned_data.get('start_date')
        if start_date:
            return timezone.make_aware(timezone.datetime.combine(start_date, timezone.datetime.min.time()))

    def get_end_datetime(self, cleaned_data):
        end_date = cleaned_data.get('end_date')
        if end_date:
            return timezone.make_aware(timezone.datetime.combine(end_date, timezone.datetime.max.time()))

class PromotionImageForm(forms.ModelForm):
    class Meta:
        model = PromotionImage
        fields = ['image']

