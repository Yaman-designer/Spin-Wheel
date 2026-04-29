"""Local development defaults (SQLite). Used by pytest when not on CI."""
import os

from .base import *

DEBUG = True
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = list(INSTALLED_APPS)
if "corsheaders" not in INSTALLED_APPS:
    INSTALLED_APPS.append("corsheaders")

CORS_ALLOW_HEADERS = [
    "x-requested-with",
    "content-type",
    "accept",
    "origin",
    "authorization",
    "x-csrftoken",
]
CORS_ORIGIN_ALLOW_ALL = True

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": str(BASE_DIR / "db.sqlite3"),
    }
}

STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")
MEDIA_ROOT = os.path.join(BASE_DIR, "media")

SERVER_URL = os.environ.get("SERVER_URL", "http://127.0.0.1:8000")
CDN_URL = os.environ.get("CDN_URL", SERVER_URL)
