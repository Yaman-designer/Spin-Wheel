from django.urls import path
from . import views

app_name = 'help'

urlpatterns = [
    path('', views.help_index, name='index'),
    path('search/', views.help_search, name='search'),
    path('<str:topic>/', views.help_detail, name='detail'),
]
