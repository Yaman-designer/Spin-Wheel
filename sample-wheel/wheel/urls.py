from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from core.admin import custom_admin_site

urlpatterns = [
    path('', include('home.urls')),
    path('admin/', custom_admin_site.urls),
    path('promotion/', include('promotion.urls')),
    path('help/', include('help.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)