from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views

router = DefaultRouter()
router.register("products", views.ProductViewSet, "product")
router.register("cart", views.CartViewSet, "cart")
router.register("orders", views.OrderViewSet, "order")

urlpatterns = [
    path("auth/register/", views.register),
    path("auth/login/", TokenObtainPairView.as_view()),
    path("auth/refresh/", TokenRefreshView.as_view()),
    path("auth/me/", views.me),
    path("payments/create/", views.payment_create),
    path("payments/verify/", views.payment_verify),
    path("", include(router.urls)),
]
