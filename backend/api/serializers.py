from rest_framework import serializers
from .models import Customer, Product, Bill, HourlySales, RevenueTrend, ShopkeeperProfile, Notification, LoginLog, ActivityLog

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

class LoginLogSerializer(serializers.ModelSerializer):
    shopkeeper_name = serializers.CharField(source='shopkeeper.name', read_only=True, default='')
    class Meta:
        model = LoginLog
        fields = '__all__'

class ActivityLogSerializer(serializers.ModelSerializer):
    shopkeeper_name = serializers.CharField(source='shopkeeper.name', read_only=True, default='')
    class Meta:
        model = ActivityLog
        fields = '__all__'

