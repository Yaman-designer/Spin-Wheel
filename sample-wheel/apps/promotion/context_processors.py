from .models import Promotion
from django.contrib.auth import get_user_model
from django.conf import settings

def get_promotions(request):
    # Security checks are disabled to enable unit testing.
    if not 'core.middleware.DisableSecurityChecksMiddleware' in settings.MIDDLEWARE:
        if request.user.is_authenticated:
            app_user = request.user
        else:
            User = get_user_model()
            app_user = User.objects.order_by("id").first()
        return {
            'promotions': app_user.promotions.all().order_by("-id") if app_user else Promotion.objects.none()
        }
    return []

