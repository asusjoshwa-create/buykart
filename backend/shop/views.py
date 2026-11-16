from rest_framework import serializers, viewsets, permissions as P
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
import razorpay
from django.conf import settings
from django.db import transaction
from .models import *

class UserS(serializers.ModelSerializer):
    class Meta: model = User; fields = ["id", "first_name", "email", "phone", "role"]

class ProductS(serializers.ModelSerializer):
    seller_name = serializers.CharField(source="seller.first_name", read_only=True)
    class Meta: model = Product; fields = "__all__"; read_only_fields = ["seller"]

class CartS(serializers.ModelSerializer):
    product_detail = ProductS(source="product", read_only=True)
    class Meta: model = CartItem; fields = ["id", "product", "qty", "product_detail"]

class OrderS(serializers.ModelSerializer):
    product_detail = ProductS(source="product", read_only=True)
    class Meta: model = Order; fields = "__all__"; read_only_fields = ["buyer", "total", "status"]

@api_view(["POST"])
@permission_classes([P.AllowAny])
def register(request):
    d = request.data
    for f in ["name", "phone", "email", "password", "role"]:
        if not d.get(f): return Response({"detail": f"{f} is required"}, 400)
    if d["role"] not in ("buyer", "seller"): return Response({"detail": "Invalid account type"}, 400)
    if User.objects.filter(username=d["email"]).exists(): return Response({"detail": "Email already registered"}, 400)
    u = User.objects.create_user(username=d["email"], email=d["email"], password=d["password"],
                                 first_name=d["name"], phone=d["phone"], role=d["role"])
    return Response(UserS(u).data, 201)

@api_view(["GET"])
def me(request): return Response(UserS(request.user).data)

class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductS
    def get_permissions(self):
        return [P.AllowAny()] if self.action in ("list", "retrieve") else [P.IsAuthenticated()]
    def get_queryset(self):
        r, qs = self.request, Product.objects.all()
        if self.action in ("update", "partial_update", "destroy") or r.query_params.get("mine"):
            qs = qs.filter(seller=r.user) if r.user.is_authenticated else qs.none()
        if c := r.query_params.get("category"): qs = qs.filter(category=c)
        if q := r.query_params.get("q"): qs = qs.filter(name__icontains=q)
        if r.query_params.get("best"): qs = qs.filter(best_seller=True)
        return qs
    def perform_create(self, s):
        if self.request.user.role != "seller": raise P.PermissionDenied("Seller account required")
        s.save(seller=self.request.user)

class CartViewSet(viewsets.ModelViewSet):
    serializer_class = CartS
    def get_queryset(self): return CartItem.objects.filter(user=self.request.user)
    def create(self, request):
        item, _ = CartItem.objects.get_or_create(user=request.user, product_id=request.data["product"])
        if not _: item.qty += 1; item.save()
        return Response(CartS(item).data, 201)

def rzp():
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

def cart_total(user):
    return sum(i.product.price * i.qty for i in CartItem.objects.filter(user=user).select_related("product"))

@transaction.atomic
def make_orders(user, pay, months, rz_order="", rz_payment=""):
    items = CartItem.objects.filter(user=user).select_related("product")
    out = [Order.objects.create(buyer=user, product=i.product, qty=i.qty, total=i.product.price * i.qty, payment=pay,
                                emi_months=months, razorpay_order_id=rz_order, razorpay_payment_id=rz_payment) for i in items]
    items.delete()
    return out

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderS
    http_method_names = ["get", "post"]
    def get_queryset(self): return Order.objects.filter(buyer=self.request.user)
    def create(self, request):  # cash on delivery only; online payments go through /payments/
        if request.data.get("payment") != "cod": return Response({"detail": "Use online payment for this method"}, 400)
        if not cart_total(request.user): return Response({"detail": "Cart is empty"}, 400)
        return Response(OrderS(make_orders(request.user, "cod", 0), many=True).data, 201)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        o = self.get_object()
        if o.status != "placed": return Response({"detail": "Order can't be cancelled"}, 400)
        if o.razorpay_payment_id:  # paid online: refund the money
            try: rzp().payment.refund(o.razorpay_payment_id, {"amount": int(o.total * 100)})
            except Exception: return Response({"detail": "Refund failed. Contact support."}, 502)
        o.status = "cancelled"; o.save()
        return Response(OrderS(o).data)

@api_view(["POST"])
def payment_create(request):
    """Step 1: server works out the amount from the cart (never trust the browser) and creates a Razorpay order."""
    total = cart_total(request.user)
    if not total: return Response({"detail": "Cart is empty"}, 400)
    o = rzp().order.create({"amount": int(total * 100), "currency": "INR", "notes": {"user": request.user.id}})
    return Response({"order_id": o["id"], "amount": o["amount"], "key": settings.RAZORPAY_KEY_ID})

@api_view(["POST"])
def payment_verify(request):
    """Step 2: check Razorpay's signature. Only a valid signature turns the cart into paid orders."""
    d = request.data
    oid, pid, sig = d.get("razorpay_order_id", ""), d.get("razorpay_payment_id", ""), d.get("razorpay_signature", "")
    try:
        rzp().utility.verify_payment_signature({"razorpay_order_id": oid, "razorpay_payment_id": pid, "razorpay_signature": sig})
    except razorpay.errors.SignatureVerificationError:
        return Response({"detail": "Payment could not be verified"}, 400)
    if Order.objects.filter(razorpay_payment_id=pid).exists(): return Response({"detail": "Already processed"}, 400)
    if rzp().order.fetch(oid)["amount"] != int(cart_total(request.user) * 100):
        return Response({"detail": "Cart changed during payment. Contact support."}, 400)
    pay = d.get("payment") if d.get("payment") in ("paypal", "gpay", "emi") else "gpay"
    return Response(OrderS(make_orders(request.user, pay, int(d.get("emi_months") or 0), oid, pid), many=True).data, 201)
