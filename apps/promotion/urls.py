from django.urls import path
from . import views
from django.contrib.staticfiles.urls import staticfiles_urlpatterns

urlpatterns = [
    path('', views.promotions, name='promotions'),
    path("new", views.new_promotion, name="new-promotion"),
    path("select-template", views.select_promotion_template, name="promotion_select_template_new"),
    path("<int:pk>/edit", views.edit_promotion, name="promotion_edit"),
    path("<int:pk>/select-template", views.select_promotion_template, name="promotion_select_template"),
    path("<int:pk>/delete", views.delete_promotion, name="delete-promotion"),
    path("<int:pk>/installation", views.install_promotion, name="install-promotion"),
    path("check_install", views.check_install, name="check-install"),
    path("<int:pk>/upload_image", views.upload_image, name="upload-image"),
    path("<int:pk>/delete_image/<int:image_id>", views.delete_image, name="delete-image"),
] + staticfiles_urlpatterns()

