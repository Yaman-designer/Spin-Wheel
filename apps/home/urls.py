from django.urls import path
from . import views
from django.contrib.staticfiles.urls import staticfiles_urlpatterns

urlpatterns = [
    path("", views.home, name="home"),
    # path("", views.test_paypal_notify_url, name="test_paypal_notify_url"),
    # path("help", views.help, name="help"),  
] + staticfiles_urlpatterns()
