import datetime
from django.db import models
from django.contrib.auth import get_user_model
import json
from django.utils.text import slugify
import random
import string
import os
from .validators import DomainValidator
from django.utils import timezone

User = get_user_model()

def get_default_value_to_theme():
  
    return {
          "popup_type": "gaming",
          "gameID": 1,
          "gameColors": {},
          "template": 101,
          "background_image": {
              "path": "",
              "style": ""
          },
          "image": {
              "path": "",
              "style": ""
          },
          "bottom_image": {
              "path": "",
              "style": ""
          },
          "popup_settings": {
              "popup_size": "medium",
              "popup_position": "left",
              "popup_position_grid": "middle_center",
              "popup_opening_effect": "fade_in_scale",
              "popup_opening_effect_duration": 700,
              "font_family": "",
          },
          "options": {
            "prevent_dublicate": True,
            "show_on_mobile": True,
            "trigger_intent_leave": False,
            "trigger_scroll_down": False,
            "start_delay_active":False,
            "start_delay": "10",
            "specific_urls": "",
            "specific_items": "",
            "smart_reward": False,
            "property_id": ""
          },
          "countdown" : {
            "active": True,
            "valid_time": "15",
            "colors": {
                "background": "#cee8e8",
                "text": "#2C7A7B"
            },
          },
          "texts" : {
            "headline": "Our store's special bonus unlocked!",
            "description": "You have a chance to win a nice big fat discount. Are you feeling lucky? Give it a spin!",
            "disclaimer": "You can spin the wheel only once. If you win, coupon can be claimed for 15 minutes only. Same email must be used when ordering.",
          },
          "input_fields": [
            {
              "id": "default_email_field",
              "label": "Email",
              "name": "email",
              "type": "email",
              "placeholder": "Enter your email address",
              "required": True,
              "style": {
                "border-color": "#dee2e6",
                "border-width": "1",
                "border-radius": "12",
                "placeholder-color": "#6c757d",
                "width": "100",
                "height": "40",
                "padding": "12",
                "alignment": "center",
                "color": "#000000",
                "background": "#ffffff",
              }
            },
            {
              "id": "default_submit_btn",
              "label": "Submit Button",
              "name": "submit_button",
              "type": "submit_button",
              "text": "Try your luck",
              "action": "submit_form",
              "action_url": "",
              "style": {
                "font-family": "Arial",
                "font-size": "16px",
                "text-align": "center",
                "font-weight": "bold",
                "font-style": "normal",
                "text-decoration": "none",
                "width": "100%",
                "height": "40px",
                "border-radius": "30px",
                "border": "none",
                "box-shadow": "inset 1px 1px rgba(255, 255, 255, 0.1), 2px 2px 1px 1px rgba(0, 0, 0, 0.1)",
                "letter-spacing": "0.05em"
              }
            },
            {
              "id": "default_close_btn",
              "label": "Button",
              "name": "button_default_close",
              "type": "submit_button",
              "text": "No, I don't feel lucky",
              "action": "close_form",
              "action_url": "",
              "style": {
                "font-family": "Arial",
                "font-size": "14px",
                "text-align": "center",
                "font-weight": "normal",
                "font-style": "normal",
                "text-decoration": "none",
                "color": "#f2f2f2"
              }
            }
          ],
        }

def get_upload_to(instance, filename):
    return os.path.join('promotions/', instance.promotion.name, filename)

class Promotion(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="promotions")
    name = models.CharField(max_length=100, verbose_name="Name")
    website = models.CharField(max_length=100, validators=[DomainValidator()])
    is_active = models.BooleanField(default=True)
    theme = models.JSONField(default=get_default_value_to_theme())
    slug = models.SlugField(max_length=255, unique=True, default='')
    start_date = models.DateField(null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)

    class Meta:
        db_table = "promotion"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # Generate a random alphanumeric string if the slug is not set
        if not self.slug:
            self.slug = self.generate_random_slug()

        if self.is_active:
            # set to passive the active promotions of same user and website
            Promotion.objects.filter(
                user=self.user,
                website=self.website,
                is_active=True
            ).update(is_active=False)

        super().save(*args, **kwargs)

    def generate_random_slug(self):
        # Generate a random string of length 10
        random_string = ''.join(random.choices(string.ascii_letters + string.digits, k=10))
        return slugify(random_string)

    @property
    def views_number(self):
        return 0

    @property
    def status(self):
        if self.is_active:
            return "in_progress"
        elif not self.is_active:
            return "stopped"
        elif self.end_date and self.end_time:
            now = datetime.now()
            end_datetime = datetime.combine(self.end_date, self.end_time)
            if now > end_datetime:
                return "time_up"
        else:
            return "created"

    def is_email_already_registered(self, email):
        """Analytics/collection removed — no server-side duplicate tracking."""
        del email
        return False

class PromotionImage(models.Model):
    class Usage(models.TextChoices):
        TOP = 'top', 'Top image'
        POPUP_BG = 'popup_bg', 'Popup background'

    promotion = models.ForeignKey(Promotion, related_name='images', on_delete=models.CASCADE)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    image = models.ImageField(upload_to=get_upload_to)
    usage = models.CharField(
        max_length=20,
        choices=Usage.choices,
        default=Usage.TOP,
        db_index=True,
    )

    class Meta:
        db_table = "promotion_image"

