from django.contrib import admin
from django.urls import path
from django.shortcuts import render
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

User = get_user_model()

class CustomAdminSite(admin.AdminSite):
    site_header = 'Wheelluck Admin'
    site_title = 'Wheelluck Admin Portal'
    index_title = 'Dashboard'
    
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('', self.admin_view(self.custom_dashboard), name='index'),
        ]
        return custom_urls + urls
    
    def custom_dashboard(self, request):
        """Custom admin dashboard with user statistics"""
        now = timezone.now()
        one_week_ago = now - timedelta(days=7)
        one_month_ago = now - timedelta(days=30)
        
        # Helper function to calculate user categories
        def get_user_stats(queryset):
            return {'total': queryset.count()}
        
        # Calculate stats for each time period
        week_stats = get_user_stats(User.objects.filter(date_joined__gte=one_week_ago))
        month_stats = get_user_stats(User.objects.filter(date_joined__gte=one_month_ago))
        total_stats = get_user_stats(User.objects.all())
        
        context = {
            **self.each_context(request),
            'title': self.index_title,
            'subtitle': None,
            'week_stats': week_stats,
            'month_stats': month_stats,
            'total_stats': total_stats,
        }
        
        return render(request, 'admin/custom_dashboard.html', context)

# Create custom admin site instance
custom_admin_site = CustomAdminSite(name='custom_admin')
