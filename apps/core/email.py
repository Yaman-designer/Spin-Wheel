from abc import ABC, abstractmethod
import logging
from django.template.loader import render_to_string
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.contrib.auth.tokens import default_token_generator
from mailjet_rest import Client
from django.conf import settings
from account.models import Account

logger = logging.getLogger(__name__)

class BaseEmailHandler(ABC):
    def __init__(self):
        self.server_url = settings.SERVER_URL
        self.info_mail_address = settings.EMAIL_SENDER
        self.from_name = settings.EMAIL_DISPLAY_NAME
        self.from_email = settings.EMAIL_SENDER

    @abstractmethod
    def _send_email(self, subject, template, recipient, context):
        pass

    def _render_template(self, template, context):
        return render_to_string(f'email_templates/{template}', {
            **context,
            "server_url": self.server_url,
            "CDN_URL": settings.CDN_URL
        })

    # def _generate_token_link(self, base_url, user):
    #     return f'{base_url}{urlsafe_base64_encode(force_bytes(user.pk))}/{default_token_generator.make_token(user)}'

    def _generate_token_link(self, base_url, user, new_email=None):
        token_data = urlsafe_base64_encode(force_bytes(user.pk))
        if new_email:
            # add email data to change email
            email_encoded = urlsafe_base64_encode(force_bytes(new_email))
            return f'{base_url}{token_data}/{email_encoded}/{default_token_generator.make_token(user)}'
        else:
            # standart token to register
            return f'{base_url}{token_data}/{default_token_generator.make_token(user)}'

    def send_verification_email(self, user, url):
        link = self._generate_token_link(url, user)
        return self._send_email(
            subject="Verify your email address",
            template="verification.html",
            recipient=user.email,
            context={"link": link, "user": user, "infoMailAdress": self.info_mail_address}
        )

    def send_email_change_verification(self, user, new_email, url):
        account = Account.objects.get(user=user)

        link = self._generate_token_link(url, user, new_email)

        return self._send_email(
            subject="Confirm your email change",
            template="email_change_verification.html",
            recipient=new_email,  # Yeni email adresine gönderiyoruz
            context={
                "user": account,
                "new_email": new_email,
                "link": link,
                "infoMailAdress": self.info_mail_address
            }
        )

    def send_forget_password_email(self, user, link):
        token_link = self._generate_token_link(link, user)
        return self._send_email(
            subject="Reset your password",
            template="forget_password.html",
            recipient=user.email,
            context={"link": token_link, "user": user, "infoMailAdress": self.info_mail_address}
        )

    def send_change_password_email(self, user):
        return self._send_email(
            subject="Your password has been changed",
            template="change_password.html",
            recipient=user.email,
            context={"user": user, "infoMailAdress": self.info_mail_address}
        )

    def send_welcome_email(self, user):
        return self._send_email(
            subject="Welcome to Whelluck",
            template="welcome.html",
            recipient=user.email,
            context={"user": user, "server_url": self.server_url,"infoMailAdress": self.info_mail_address}
        )

class MailjetEmailHandler(BaseEmailHandler):
    def __init__(self):
        super().__init__()
        self.client = Client(
            auth=(settings.MAILJET_API_KEY, settings.MAILJET_API_SECRET),
            version='v3.1'
        )

    def _send_email(self, subject, template, recipient, context, attachments=None):
        try:
            message = self._render_template(template, context)
            data = {
                'Messages': [{
                    'From': {
                        'Email': self.from_email,
                        'Name': self.from_name
                    },
                    'To': [{
                        'Email': recipient
                    }],
                    'Subject': subject,
                    'HTMLPart': message,
                }]
            }

            # Add attachments if providewd
            if attachments:
                data['Messages'][0]['Attachments'] = attachments
                
            result = self.client.send.create(data)
            result.raise_for_status()
            return result.json()
        except Exception as e:
            logger.error(f"Mailjet email sending failed: {str(e)}")
            return False

class KlaviyoEmailHandler(BaseEmailHandler):
    def __init__(self):
        super().__init__()
        # self.client = Klaviyo(settings.KLAVIYO_API_KEY)

    def _send_email(self, subject, template, recipient, context):
        try:
            message = self._render_template(template, context)

            # self.client.messages.create(
            #     to_email=recipient,
            #     subject=subject,
            #     content=context,
            #     content_type='html'
            # )

            return True
        except Exception as e:
            logger.error(f"Klaviyo email sending failed: {str(e)}")
            return False

def get_email_handler():
    raw = getattr(settings, "EMAIL_PROVIDER", None)
    if raw is None or str(raw).strip() == "":

        def _noop_send(self, subject, template, recipient, context, attachments=None):
            return True

        return type("_", (BaseEmailHandler,), {"_send_email": _noop_send})()

    provider = str(raw).strip().lower()
    handlers = {
        "mailjet": MailjetEmailHandler,
        "klaviyo": KlaviyoEmailHandler,
    }
    handler_class = handlers.get(provider)
    if not handler_class:
        raise ValueError(f"Unknown email provider: {settings.EMAIL_PROVIDER!r}")
    return handler_class()
