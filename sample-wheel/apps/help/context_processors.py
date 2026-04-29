import os

def help_topics(request):
    templates_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'help', 'templates')
    
    # Custom titles for specific help topics
    custom_titles = {
        'manage_promotion': 'How can I add, delete or edit promotions?',
        'change_promotion_template': 'How can I change the promotion template?',
        'change_promotion_colors': 'How can I change colors in my promotion theme?',
        'add_background_image': 'How can I add a background image to my promotion?',
        'promotion_schedule': 'How can I schedule my promotion?',
        'promotion_options': 'How can I configure promotion options?',
        'promotion_texts': 'How can I customize promotion texts?',
        'promotion_rewards': 'How can I configure promotion rewards?',
        'promotion_countdown': 'How can I configure the countdown timer?',
        'add_remove_payment_method': 'How can I add/remove payment method?',
        'purchase_change_plan': 'How can I Purchase Or Change My Plan?',
        'user_management': 'How can I update my profile information?',
        'password_management': 'How do I change my password?',
        'check_remaining_limits': 'How do I check remaining limits in my plan?',
        'manage_billing': 'How can I manage my billing?',
        # Add more custom titles as needed
    }
    
    help_topics = []
    try:
        for filename in os.listdir(templates_dir):
            if filename.endswith('.html') and filename != 'index.html' and filename != 'help_layout.html' and filename != 'sidebar.html' and filename != 'help_detail.html':
                slug = filename[:-5].replace('_', '-')  # Remove .html extension and replace _ with -
                slug_key = filename[:-5]  # Keep original for custom_titles lookup
                
                # Use custom title if available, otherwise generate from filename
                if slug_key in custom_titles:
                    title = custom_titles[slug_key]
                else:
                    title = slug_key.replace('_', ' ').title()
                
                help_topics.append({
                    'title': title,
                    'url': f'/help/{slug}/',
                })
        help_topics.sort(key=lambda x: x['title'])
        return {'help_topics': help_topics}
    except Exception:
        return {'help_topics': []}