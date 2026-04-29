from django import template
from django.utils.timesince import timesince
from datetime import datetime
from django.utils import timezone

register = template.Library()

@register.filter
def short_timesince(value):
    now = timezone.now()
    diff = now - value
    periods = (
        (diff.days // 365, "years"),
        (diff.days % 365 // 30, "months"),
        (diff.days % 30 // 7, "weeks"),
        (diff.days % 7, "days"),
        (diff.seconds // 3600, "hours"),
        (diff.seconds % 3600 // 60, "minutes"),
        (diff.seconds % 60, "seconds"),
    )
    for period, suffix in periods:
        if period > 0:
            return f"{period} {suffix}"
    return "0s"

@register.filter
def get_object_or_none(dictionary, key):
    """
    Sözlükten verilen anahtar ile değeri döndürür.
    Eğer anahtar mevcut değilse None döndürür.
    """
    return dictionary.get(key)
