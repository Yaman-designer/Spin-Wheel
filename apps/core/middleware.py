from django.shortcuts import render
from django.http import HttpResponseForbidden

class InternalErrorMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if response.status_code == 500:
            return render(request, 'error.html', status=500)
        return response

# class RestrictAccessMiddleware:
#     def __init__(self, get_response):
#         self.get_response = get_response
#
#     def __call__(self, request):
#         # Burada URL erişim kontrolünü yapabilirsiniz
#         if request.path.startswith('/account'):
#             return HttpResponseForbidden("Bu sayfaya erişim izniniz yok.")
#
#         response = self.get_response(request)
#         return response


from django.contrib.auth import get_user_model
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings
from django.http import HttpResponseForbidden

User = get_user_model()

class DisableSecurityChecksMiddleware(MiddlewareMixin):
    def process_request(self, request):
        if settings.DEBUG:  # Örneğin, sadece geliştirme ortamında
            # Atla CSRF kontrolü
            setattr(request, '_dont_enforce_csrf_checks', True)

            # Atla login_required kontrolü
            request.user = User()  # Boş bir kullanıcı nesnesi oluştur
            request._cached_user = User()
            request.session['_auth_user_id'] = None
            request.session['_auth_user_backend'] = None
            request.session['_auth_user_hash'] = None
        return None

    def process_view(self, request, view_func, view_args, view_kwargs):
        if settings.DEBUG:
            # `login_required` dekoratörünü atla
            # Ancak view işleme sırasına göre, bunun uygulanabilmesi için view fonksiyonunda ek kontroller yapmak gerekebilir.
            pass

    def process_response(self, request, response):
        return response
