from django.db import models

class ShopkeeperProfile(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=255, default='password123') # Basic password field
    phone = models.CharField(max_length=20, blank=True, null=True)
    store_name = models.CharField(max_length=255)
    address = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    
    def __str__(self):
        return f"{self.store_name} ({self.name})"

class Customer(models.Model):
    shopkeeper = models.ForeignKey(ShopkeeperProfile, on_delete=models.CASCADE, null=True, blank=True, related_name='customers')
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)
    # UI Metadata
    initials = models.CharField(max_length=5, blank=True, null=True)
    tone = models.CharField(max_length=50, blank=True, null=True)

    def __str__(self):
        return self.name

class Product(models.Model):
    shopkeeper = models.ForeignKey(ShopkeeperProfile, on_delete=models.CASCADE, null=True, blank=True, related_name='products')
    name = models.CharField(max_length=255)
    barcode = models.CharField(max_length=100, blank=True, null=True)
    sold = models.CharField(max_length=50, default='0')
    value = models.CharField(max_length=50)
    width = models.CharField(max_length=10, default='0%')
    color = models.CharField(max_length=50, default='bg-violet-500')

    def __str__(self):
        return self.name

class Bill(models.Model):
    shopkeeper = models.ForeignKey(ShopkeeperProfile, on_delete=models.CASCADE, null=True, blank=True, related_name='bills')
    invoice = models.CharField(max_length=50)
    customer = models.CharField(max_length=255)
    amount = models.CharField(max_length=50)
    time = models.CharField(max_length=50)
    status = models.CharField(max_length=50)
    initials = models.CharField(max_length=5)
    tone = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    def __str__(self):
        return self.invoice

class HourlySales(models.Model):
    shopkeeper = models.ForeignKey(ShopkeeperProfile, on_delete=models.CASCADE, null=True, blank=True, related_name='hourly_sales')
    hour = models.CharField(max_length=20)
    sales = models.IntegerField()

    def __str__(self):
        return f"{self.hour}: {self.sales}"

class RevenueTrend(models.Model):
    shopkeeper = models.ForeignKey(ShopkeeperProfile, on_delete=models.CASCADE, null=True, blank=True, related_name='revenue_trends')
    day = models.CharField(max_length=20)
    value = models.IntegerField()

    def __str__(self):
        return f"{self.day}: {self.value}"

class Notification(models.Model):
    shopkeeper = models.ForeignKey(ShopkeeperProfile, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    title = models.CharField(max_length=255)
    description = models.TextField()
    time = models.CharField(max_length=50)
    icon = models.CharField(max_length=50)
    color = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title
