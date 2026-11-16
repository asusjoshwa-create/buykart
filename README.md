# Buykart (React + Django)

## Backend
```
cd backend
python -m venv venv && source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
django-admin startproject buykart .
python manage.py startapp shop --  # then REPLACE models.py, views.py and ADD urls.py from this folder's shop/
```
(If `startapp` creates a `shop` folder, just overwrite its models.py/views.py and add urls.py.)

Add to `buykart/settings.py`:
```python
from datetime import timedelta
INSTALLED_APPS += ["rest_framework", "corsheaders", "shop"]
MIDDLEWARE.insert(0, "corsheaders.middleware.CorsMiddleware")
AUTH_USER_MODEL = "shop.User"
CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]
MEDIA_URL = "/media/"; MEDIA_ROOT = BASE_DIR / "media"
REST_FRAMEWORK = {"DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
                  "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"]}
# TOKEN TIMING: access token lasts 30 min, refresh token 1 day. After 30 min the site
# automatically asks for a new access token; after 1 day the customer must log in again.
SIMPLE_JWT = {"ACCESS_TOKEN_LIFETIME": timedelta(minutes=30), "REFRESH_TOKEN_LIFETIME": timedelta(days=1)}
```
In `buykart/urls.py`:
```python
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
urlpatterns = [path("api/", include("shop.urls"))] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```
Then: `python manage.py makemigrations shop && python manage.py migrate && python manage.py runserver`

## Real payments (Razorpay)
1. Sign up at razorpay.com, open Dashboard > Settings > API keys, and generate **Test mode** keys.
2. Set them before running the server (never put them in the React code):
```
export RAZORPAY_KEY_ID=rzp_test_xxxxx
export RAZORPAY_KEY_SECRET=xxxxx
```
3. Add to `settings.py`:
```python
import os
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
```
4. Test cards/UPI: see Razorpay "Test card details" docs. Switch to Live keys only after your KYC is approved.

How it works: GPay (UPI), EMI and PayPal open Razorpay's payment window. Django creates the order and checks the signature, and only then saves the paid orders. Cash on delivery skips the gateway. Cancelling a paid order refunds it automatically.
Notes: PayPal and EMI must be enabled on your Razorpay account (Settings > Payment methods; PayPal needs international payments approval). Existing databases need `makemigrations` and `migrate` again because Order has two new fields.

## Frontend
```
cd frontend && npm install && npm run dev      # http://localhost:5173
```
