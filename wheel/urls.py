"""
URL configuration for wheel project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path,include
from django.conf import settings
from django.conf.urls.static import static
from core.admin import custom_admin_site

# Register all models with custom admin site
from django.apps import apps
from django.contrib.admin.sites import AlreadyRegistered, site , AlreadyRegistered

for model, model_admin in admin.site._registry.items():
    try:
        custom_admin_site.register(model, model_admin.__class__)
    except AlreadyRegistered:
        pass

urlpatterns = [
    path('', include('home.urls')),
    path('admin/', custom_admin_site.urls),
    path('promotion/', include('promotion.urls')),
    path('help/', include('help.urls')),
]

# for development environment
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
