from rest_framework import serializers
from .models import Customer, Product, Bill, HourlySales, RevenueTrend, ShopkeeperProfile, Notification

class CustomerSerializer(serializers.ModelSerializer):
    shopkeeper = serializers.PrimaryKeyRelatedField(read_only=True)
    class Meta:
        model = Customer
        fields = '__all__'

class ProductSerializer(serializers.ModelSerializer):
    shopkeeper = serializers.PrimaryKeyRelatedField(read_only=True)
    class Meta:
        model = Product
        fields = '__all__'

class BillSerializer(serializers.ModelSerializer):
    shopkeeper = serializers.PrimaryKeyRelatedField(read_only=True)
    class Meta:
        model = Bill
        fields = '__all__'

class HourlySalesSerializer(serializers.ModelSerializer):
    shopkeeper = serializers.PrimaryKeyRelatedField(read_only=True)
    class Meta:
        model = HourlySales
        fields = '__all__'

class RevenueTrendSerializer(serializers.ModelSerializer):
    shopkeeper = serializers.PrimaryKeyRelatedField(read_only=True)
    class Meta:
        model = RevenueTrend
        fields = '__all__'

class NotificationSerializer(serializers.ModelSerializer):
    shopkeeper = serializers.PrimaryKeyRelatedField(read_only=True)
    class Meta:
        model = Notification
        fields = '__all__'
