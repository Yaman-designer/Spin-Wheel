from django.conf import settings

def get_media_url(request):
    return {'CDN_URL': settings.CDN_URL}
