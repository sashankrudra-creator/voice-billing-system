import json
from django.core.management.base import BaseCommand
from api.models import Customer, Product, Bill, HourlySales, RevenueTrend, ShopkeeperProfile

class Command(BaseCommand):
    help = 'Seed database with initial data'

    def handle(self, *args, **kwargs):
        # Clear existing data
        Customer.objects.all().delete()
        Product.objects.all().delete()
        Bill.objects.all().delete()
        HourlySales.objects.all().delete()
        RevenueTrend.objects.all().delete()

        ShopkeeperProfile.objects.all().delete()

        # Seed Shopkeeper
        ShopkeeperProfile.objects.create(
            name="Rajesh Kumar",
            email="shopkeeper@example.com",
            password="password",
            phone="+91 99999 88888",
            store_name="GreenBasket Store"
        )

        # Insert recent customers
        recentCustomers = [
            { "name": "Ananya Sharma", "phone": "+91 98765 43210", "initials": "AS", "tone": "violet" },
            { "name": "Meera Iyer", "phone": "+91 99887 12020", "initials": "MI", "tone": "amber" },
            { "name": "Rohan Mehta", "phone": "+91 98111 65784", "initials": "RM", "tone": "blue" },
        ]
        for c in recentCustomers:
            Customer.objects.create(**c)

        # Insert products
        topProducts = [
            { "name": "Amul Taaza Milk", "sold": "142 sold", "value": "₹7,810", "width": "92%", "color": "bg-violet-500" },
            { "name": "Fortune Basmati Rice", "sold": "98 sold", "value": "₹6,370", "width": "72%", "color": "bg-blue-500" },
            { "name": "Harvest White Bread", "sold": "84 sold", "value": "₹3,780", "width": "61%", "color": "bg-amber-400" },
            { "name": "Farm Fresh Eggs", "sold": "75 sold", "value": "₹3,150", "width": "54%", "color": "bg-emerald-500" },
            { "name": "Fortune Sunflower Oil", "sold": "62 sold", "value": "₹8,060", "width": "44%", "color": "bg-rose-400" },
        ]
        for p in topProducts:
            Product.objects.create(**p)

        # Insert bills
        recentBills = [
            { "invoice": "#QV-2084", "customer": "Ananya Sharma", "amount": "₹1,240", "time": "10:42 AM", "status": "Paid", "initials": "AS", "tone": "violet" },
            { "invoice": "#QV-2083", "customer": "Rohan Mehta", "amount": "₹860", "time": "10:28 AM", "status": "Paid", "initials": "RM", "tone": "blue" },
            { "invoice": "#QV-2082", "customer": "Meera Iyer", "amount": "₹2,450", "time": "10:10 AM", "status": "WhatsApp", "initials": "MI", "tone": "amber" },
            { "invoice": "#QV-2081", "customer": "Arjun Nair", "amount": "₹540", "time": "9:54 AM", "status": "Paid", "initials": "AN", "tone": "green" },
            { "invoice": "#QV-2080", "customer": "Priya Kapoor", "amount": "₹1,780", "time": "9:41 AM", "status": "Pending", "initials": "PK", "tone": "rose" },
        ]
        for b in recentBills:
            Bill.objects.create(**b)

        # Insert HourlySales
        salesByHour = [
            { "hour": "8 AM", "sales": 720 },
            { "hour": "10 AM", "sales": 1240 },
            { "hour": "12 PM", "sales": 2480 },
            { "hour": "2 PM", "sales": 1620 },
            { "hour": "4 PM", "sales": 2780 },
            { "hour": "6 PM", "sales": 3560 },
            { "hour": "8 PM", "sales": 2940 },
            { "hour": "10 PM", "sales": 2140 },
        ]
        for s in salesByHour:
            HourlySales.objects.create(**s)

        # Insert RevenueTrend
        revenueTrend = [
            { "day": "16 Jul", "value": 9400 },
            { "day": "17 Jul", "value": 11800 },
            { "day": "18 Jul", "value": 10500 },
            { "day": "19 Jul", "value": 13200 },
            { "day": "20 Jul", "value": 12450 },
            { "day": "21 Jul", "value": 14800 },
            { "day": "22 Jul", "value": 10250 },
            { "day": "23 Jul", "value": 15240 },
        ]
        for r in revenueTrend:
            RevenueTrend.objects.create(**r)



        self.stdout.write(self.style.SUCCESS('Successfully seeded database!'))
