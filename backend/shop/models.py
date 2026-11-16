from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):  # username = email
    phone = models.CharField(max_length=15)
    role = models.CharField(max_length=6, choices=[("buyer", "Buyer"), ("seller", "Seller")], default="buyer")

CATEGORIES = [(c, c.title()) for c in ["apparel", "electronics", "mobile", "cosmetics", "furniture", "food"]]

class Product(models.Model):
    seller = models.ForeignKey(User, on_delete=models.CASCADE, related_name="products")
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=20, choices=CATEGORIES)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField()
    image = models.ImageField(upload_to="products/")
    best_seller = models.BooleanField(default=False)
    created = models.DateTimeField(auto_now_add=True)
    class Meta: ordering = ["-created"]

class CartItem(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    qty = models.PositiveIntegerField(default=1)
    class Meta: unique_together = ("user", "product")

class Order(models.Model):
    buyer = models.ForeignKey(User, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    qty = models.PositiveIntegerField()
    total = models.DecimalField(max_digits=12, decimal_places=2)
    payment = models.CharField(max_length=10, choices=[("paypal", "PayPal"), ("gpay", "GPay"), ("cod", "Cash on delivery"), ("emi", "EMI")])
    emi_months = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=10, default="placed")  # placed / cancelled
    razorpay_order_id = models.CharField(max_length=60, blank=True)
    razorpay_payment_id = models.CharField(max_length=60, blank=True)
    created = models.DateTimeField(auto_now_add=True)
    class Meta: ordering = ["-created"]
