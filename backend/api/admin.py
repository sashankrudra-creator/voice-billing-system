from django.contrib import admin
from .models import Customer, Product, Bill, HourlySales, RevenueTrend, ShopkeeperProfile, Notification

admin.site.register(Customer)
admin.site.register(Product)
admin.site.register(Bill)
admin.site.register(HourlySales)
admin.site.register(RevenueTrend)

admin.site.register(ShopkeeperProfile)
admin.site.register(Notification)
