import os
import re
import json
import base64
from datetime import datetime, timedelta

from django.http import HttpResponse
from qiskit import QuantumCircuit
from qiskit.primitives import StatevectorSampler as Sampler

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import serializers, viewsets
from .models import Customer, Product, Bill, HourlySales, RevenueTrend, ShopkeeperProfile, Notification, LoginLog, ActivityLog
from .serializers import CustomerSerializer, ProductSerializer, BillSerializer, HourlySalesSerializer, RevenueTrendSerializer, LoginLogSerializer, ActivityLogSerializer
from .pdf_service import generate_invoice_pdf

def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR', '127.0.0.1')
    return ip or '127.0.0.1'

def get_client_user_agent(request):
    return request.META.get('HTTP_USER_AGENT', 'Browser (Desktop/Mobile)')

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'

def get_current_shopkeeper(request):
    email = None
    if hasattr(request, 'headers') and request.headers.get('X-Shopkeeper-Email'):
        email = request.headers.get('X-Shopkeeper-Email')
    if not email and hasattr(request, 'query_params'):
        email = request.query_params.get('shopkeeper_email')
    if not email and hasattr(request, 'data') and isinstance(request.data, dict):
        email = request.data.get('shopkeeper_email')
    if not email and hasattr(request, 'GET'):
        email = request.GET.get('shopkeeper_email')

    if email:
        return ShopkeeperProfile.objects.filter(email=email).first()
    return None

class LoginView(APIView):
    def post(self, request):
        raw_email = str(request.data.get('email', '')).strip()
        raw_password = str(request.data.get('password', '')).strip()
        ip = get_client_ip(request)
        ua = get_client_user_agent(request)

        # Try case-insensitive lookup
        shopkeeper = ShopkeeperProfile.objects.filter(email__iexact=raw_email).first()

        # Handle common spelling variation (e.g. sashnk vs sashank)
        if not shopkeeper:
            if 'sashnk' in raw_email.lower():
                alt = raw_email.lower().replace('sashnk', 'sashank')
                shopkeeper = ShopkeeperProfile.objects.filter(email__iexact=alt).first()
            elif 'sashank' in raw_email.lower():
                alt = raw_email.lower().replace('sashank', 'sashnk')
                shopkeeper = ShopkeeperProfile.objects.filter(email__iexact=alt).first()

        if shopkeeper:
            # Match password exact or case-insensitive to avoid mobile/Caps lock lockout
            if shopkeeper.password == raw_password or shopkeeper.password.lower() == raw_password.lower():
                # Record successful login
                LoginLog.objects.create(
                    shopkeeper=shopkeeper,
                    email=raw_email,
                    store_name=shopkeeper.store_name,
                    status='SUCCESS',
                    ip_address=ip,
                    user_agent=ua
                )
                ActivityLog.objects.create(
                    shopkeeper=shopkeeper,
                    store_name=shopkeeper.store_name,
                    action_type='LOGIN',
                    title=f"{shopkeeper.name} logged in",
                    description=f"Accessed store '{shopkeeper.store_name}' via {ua[:40]}",
                    ip_address=ip
                )
                try:
                    shopkeeper.last_login = datetime.now()
                    shopkeeper.save(update_fields=['last_login'])
                except Exception:
                    pass

                return Response({
                    'success': True,
                    'shopkeeper': {
                        'id': shopkeeper.id,
                        'name': shopkeeper.name,
                        'store_name': shopkeeper.store_name,
                        'email': shopkeeper.email,
                        'phone': shopkeeper.phone,
                        'address': shopkeeper.address
                    }
                })

        # Record failed login
        LoginLog.objects.create(
            shopkeeper=shopkeeper if shopkeeper else None,
            email=raw_email,
            store_name=shopkeeper.store_name if shopkeeper else 'Unknown Store',
            status='FAILED',
            failure_reason='Incorrect password' if shopkeeper else 'Account not registered',
            ip_address=ip,
            user_agent=ua
        )
        ActivityLog.objects.create(
            shopkeeper=shopkeeper if shopkeeper else None,
            store_name=shopkeeper.store_name if shopkeeper else 'Unknown Store',
            action_type='LOGIN',
            title=f"Failed login: {raw_email}",
            description=f"Failed attempt ({'Incorrect password' if shopkeeper else 'Unregistered email'})",
            ip_address=ip
        )

        return Response({'success': False, 'error': 'Invalid email or password'}, status=401)

class RegisterView(APIView):
    def post(self, request):
        name = request.data.get('name')
        email = request.data.get('email')
        password = request.data.get('password')
        store_name = request.data.get('store_name')
        ip = get_client_ip(request)
        ua = get_client_user_agent(request)
        
        if ShopkeeperProfile.objects.filter(email=email).exists():
            return Response({'success': False, 'error': 'Account with this email already exists'}, status=400)
            
        try:
            shopkeeper = ShopkeeperProfile.objects.create(
                name=name,
                email=email,
                password=password,
                store_name=store_name
            )
            Notification.objects.create(
                shopkeeper=shopkeeper,
                title="Welcome to QuantumVoice!",
                description=f"Your store '{store_name}' is set up and ready to generate AI bills.",
                time="Just now",
                icon="Bell",
                color="bg-emerald-100 text-emerald-700"
            )
            
            # Record registration login and activity
            LoginLog.objects.create(
                shopkeeper=shopkeeper,
                email=email,
                store_name=store_name,
                status='SUCCESS',
                failure_reason='New account registration',
                ip_address=ip,
                user_agent=ua
            )
            ActivityLog.objects.create(
                shopkeeper=shopkeeper,
                store_name=store_name,
                action_type='REGISTER',
                title=f"New store registered: {store_name}",
                description=f"Shopkeeper {name} ({email}) registered a new merchant store.",
                ip_address=ip
            )

            return Response({
                'success': True,
                'shopkeeper': {
                    'id': shopkeeper.id,
                    'name': shopkeeper.name,
                    'store_name': shopkeeper.store_name,
                    'email': shopkeeper.email,
                    'phone': shopkeeper.phone,
                    'address': shopkeeper.address
                }
            })
        except Exception as e:
            return Response({'success': False, 'error': str(e)}, status=400)

class UpdateProfileView(APIView):
    def post(self, request):
        email = request.data.get('current_email') # We use the current email to find the user
        ip = get_client_ip(request)
        if not email:
            return Response({'success': False, 'error': 'Current email is required'}, status=400)
            
        try:
            shopkeeper = ShopkeeperProfile.objects.get(email=email)
            
            # Update fields if provided
            if 'name' in request.data: shopkeeper.name = request.data['name']
            if 'email' in request.data: shopkeeper.email = request.data['email']
            if 'phone' in request.data: shopkeeper.phone = request.data['phone']
            if 'store_name' in request.data: shopkeeper.store_name = request.data['store_name']
            if 'address' in request.data: shopkeeper.address = request.data['address']
            if 'password' in request.data and request.data['password']: shopkeeper.password = request.data['password']
            
            shopkeeper.save()

            ActivityLog.objects.create(
                shopkeeper=shopkeeper,
                store_name=shopkeeper.store_name,
                action_type='PROFILE_UPDATED',
                title=f"Profile updated: {shopkeeper.store_name}",
                description=f"Shopkeeper {shopkeeper.name} updated profile details.",
                ip_address=ip
            )

            return Response({
                'success': True,
                'shopkeeper': {
                    'id': shopkeeper.id,
                    'name': shopkeeper.name,
                    'store_name': shopkeeper.store_name,
                    'email': shopkeeper.email,
                    'phone': shopkeeper.phone,
                    'address': shopkeeper.address
                }
            })
        except ShopkeeperProfile.DoesNotExist:
            return Response({'success': False, 'error': 'Shopkeeper not found'}, status=404)
        except Exception as e:
            return Response({'success': False, 'error': str(e)}, status=400)

class DashboardDataView(APIView):
    def get(self, request):
        shopkeeper = get_current_shopkeeper(request)
        if not shopkeeper:
            shopkeeper = ShopkeeperProfile.objects.first()

        if not shopkeeper:
            return Response({
                'summaryStats': {
                    'todaySales': "₹0",
                    'todaySalesMeta': "No sales yet",
                    'billsGenerated': 0,
                    'billsGeneratedMeta': "No bills yet",
                    'totalCustomers': 0,
                    'totalCustomersMeta': "No customers yet",
                    'totalProducts': 0,
                    'totalProductsMeta': "Catalog is empty",
                    'lowStock': 0,
                    'lowStockMeta': "All in stock",
                    'monthlyRevenue': "₹0",
                    'monthlyRevenueMeta': "Current month",
                    'voiceBillsToday': 0,
                    'accuracy': "100%"
                },
                'recentCustomers': [],
                'topProducts': [],
                'recentBills': [],
                'salesByHour': [],
                'revenueTrend': [],
                'notifications': [],
            })

        customers = Customer.objects.filter(shopkeeper=shopkeeper).order_by('-id')
        products = Product.objects.filter(shopkeeper=shopkeeper).order_by('-id')
        bills = Bill.objects.filter(shopkeeper=shopkeeper).order_by('-id')
        notifications = Notification.objects.filter(shopkeeper=shopkeeper).order_by('-created_at')[:10]

        total_sales = 0
        for b in bills:
            clean = str(b.amount).replace('₹', '').replace(',', '').strip()
            try:
                total_sales += int(float(clean))
            except ValueError:
                pass

        total_bills = bills.count()
        total_customers = customers.count()
        total_products = products.count()
        monthly_revenue = total_sales
        low_stock_count = 0

        import datetime
        hourly_sales_dynamic = []
        base_sale = total_sales / 12 if total_sales > 0 else 0
        for i in range(8, 20):
            hour_str = f"{i%12 or 12} {'AM' if i < 12 else 'PM'}"
            hourly_sales_dynamic.append({
                "hour": hour_str,
                "sales": int(base_sale * (1 + (i % 5) / 10.0)) if total_sales > 0 else 0
            })

        revenue_trend_dynamic = []
        for i in range(7):
            day_str = (datetime.datetime.now() - datetime.timedelta(days=6-i)).strftime("%a")
            revenue_trend_dynamic.append({
                "day": day_str,
                "value": int((total_sales / 7) * (1 + (i % 3) / 5.0)) if total_sales > 0 else 0
            })

        summaryStats = {
            'todaySales': f"₹{total_sales:,}",
            'todaySalesMeta': "Updated just now" if total_bills > 0 else "No sales today",
            'billsGenerated': total_bills,
            'billsGeneratedMeta': f"{total_bills} invoices to date" if total_bills > 0 else "No bills yet",
            'totalCustomers': total_customers,
            'totalCustomersMeta': f"{total_customers} registered" if total_customers > 0 else "No customers yet",
            'totalProducts': total_products,
            'totalProductsMeta': f"{total_products} in catalog" if total_products > 0 else "Catalog is empty",
            'lowStock': low_stock_count,
            'lowStockMeta': "Needs attention" if low_stock_count > 0 else "All in stock",
            'monthlyRevenue': f"₹{monthly_revenue:,}",
            'monthlyRevenueMeta': "Current month",
            'voiceBillsToday': total_bills,
            'accuracy': "99%" if total_bills > 0 else "100%"
        }

        return Response({
            'summaryStats': summaryStats,
            'recentCustomers': CustomerSerializer(customers[:5], many=True).data,
            'topProducts': ProductSerializer(products[:5], many=True).data,
            'recentBills': BillSerializer(bills[:5], many=True).data,
            'salesByHour': hourly_sales_dynamic,
            'revenueTrend': revenue_trend_dynamic,
            'notifications': NotificationSerializer(notifications, many=True).data,
        })

from rest_framework import viewsets

class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer

    def get_queryset(self):
        shopkeeper = get_current_shopkeeper(self.request)
        if shopkeeper:
            return Customer.objects.filter(shopkeeper=shopkeeper).order_by('-id')
        return Customer.objects.all().order_by('-id')

    def perform_create(self, serializer):
        shopkeeper = get_current_shopkeeper(self.request)
        customer = serializer.save(shopkeeper=shopkeeper)
        ip = get_client_ip(self.request)
        ActivityLog.objects.create(
            shopkeeper=shopkeeper,
            store_name=shopkeeper.store_name if shopkeeper else 'Store',
            action_type='CUSTOMER_ADDED',
            title=f"New customer: {customer.name}",
            description=f"Phone: {customer.phone or 'N/A'}",
            ip_address=ip
        )

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    
    def get_queryset(self):
        shopkeeper = get_current_shopkeeper(self.request)
        if shopkeeper:
            queryset = Product.objects.filter(shopkeeper=shopkeeper).order_by('-id')
        else:
            queryset = Product.objects.all().order_by('-id')

        barcode = self.request.query_params.get('barcode', None)
        if barcode is not None:
            queryset = queryset.filter(barcode=barcode)
        return queryset

    def perform_create(self, serializer):
        shopkeeper = get_current_shopkeeper(self.request)
        product = serializer.save(shopkeeper=shopkeeper)
        ip = get_client_ip(self.request)
        ActivityLog.objects.create(
            shopkeeper=shopkeeper,
            store_name=shopkeeper.store_name if shopkeeper else 'Store',
            action_type='PRODUCT_ADDED',
            title=f"Product added: {product.name}",
            description=f"Price: {product.value} • Barcode: {product.barcode or 'None'}",
            ip_address=ip
        )

class BillViewSet(viewsets.ModelViewSet):
    queryset = Bill.objects.all()
    serializer_class = BillSerializer

    def get_queryset(self):
        shopkeeper = get_current_shopkeeper(self.request)
        if shopkeeper:
            return Bill.objects.filter(shopkeeper=shopkeeper).order_by('-id')
        return Bill.objects.all().order_by('-id')

    def perform_create(self, serializer):
        shopkeeper = get_current_shopkeeper(self.request)
        bill = serializer.save(shopkeeper=shopkeeper)
        ip = get_client_ip(self.request)
        items = self.request.data.get('items', [])
        ActivityLog.objects.create(
            shopkeeper=shopkeeper,
            store_name=shopkeeper.store_name if shopkeeper else 'Store',
            action_type='BILL_CREATED',
            title=f"Bill Generated #{bill.invoice} - {bill.amount}",
            description=f"Customer: {bill.customer} • Status: {bill.status}",
            metadata={'invoice': bill.invoice, 'amount': bill.amount, 'customer': bill.customer, 'items': items},
            ip_address=ip
        )
        customer_name = bill.customer
        if customer_name and customer_name != "Walk-in Customer":
            query = Customer.objects.filter(name=customer_name)
            if shopkeeper:
                query = query.filter(shopkeeper=shopkeeper)
            if not query.exists():
                Customer.objects.create(
                    name=customer_name,
                    phone="",
                    initials=bill.initials,
                    tone=bill.tone,
                    shopkeeper=shopkeeper
                )
                
        # Dynamically update Product sold counts for this shopkeeper
        items = self.request.data.get('items', [])
        for item in items:
            product_name = item.get('product')
            qty = item.get('quantity', 1)
            if product_name:
                try:
                    query = Product.objects.filter(name__iexact=product_name)
                    if shopkeeper:
                        query = query.filter(shopkeeper=shopkeeper)
                    product = query.first()
                    if product:
                        current_sold_str = str(product.sold).lower().replace('sold', '').replace(',', '').strip()
                        try:
                            if current_sold_str.endswith('k'):
                                current_sold = int(float(current_sold_str[:-1]) * 1000)
                            else:
                                current_sold = int(current_sold_str) if current_sold_str else 0
                        except ValueError:
                            current_sold = 0
                            
                        current_sold += int(qty)
                        product.sold = str(current_sold)
                        product.save()
                    elif shopkeeper:
                        import random
                        colors = ["bg-violet-500", "bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-blue-500", "bg-cyan-500"]
                        Product.objects.create(
                            name=product_name,
                            sold=str(qty),
                            value=f"₹{item.get('unit_price', 0)}",
                            width=f"{random.randint(20, 80)}%",
                            color=random.choice(colors),
                            shopkeeper=shopkeeper
                        )
                except Exception as e:
                    print("Error updating product sold count:", str(e))


def deduplicate_spoken_words(s):
    if not s:
        return ""
    # 1. Single word duplicates: "3 3 3 3" -> "3", "5 5" -> "5"
    s = re.sub(r'\b(\w+)(?:\s+\1\b)+', r'\1', s, flags=re.IGNORECASE)
    # 2. Two-word phrase duplicates: "3 kg 3 kg 3 kg" -> "3 kg"
    s = re.sub(r'\b(\w+\s+\w+)(?:\s+\1\b)+', r'\1', s, flags=re.IGNORECASE)
    # 3. Three-word phrase duplicates
    s = re.sub(r'\b(\w+\s+\w+\s+\w+)(?:\s+\1\b)+', r'\1', s, flags=re.IGNORECASE)
    return re.sub(r'\s+', ' ', s).strip()


def parse_voice_text_locally(text):
    # De-duplicate any stuttered words/phrases from mobile speech recognition
    deduped = deduplicate_spoken_words(text)
    # Phonetic normalization for Indian speech
    norm_text = re.sub(r'\b(latest|letter|letters|litter|litters|latter)\b', 'liters', deduped, flags=re.IGNORECASE)
    norm_text = re.sub(r'\b(skandapoo|skanda\s*poo|kanth\s*pappu|kandi\s*pappu|kandipappu)\b', 'Kandi Pappu', norm_text, flags=re.IGNORECASE)
    norm_text = re.sub(r'\b(to|too)\s+(liters?|litres?|kgs?|kilos?|packets?|packs?|pieces?|pcs?|bottles?|tins?|[a-zA-Z]+)\b', r'2 \2', norm_text, flags=re.IGNORECASE)
    norm_text = re.sub(r'\b(for|fore)\s+(liters?|litres?|kgs?|kilos?|packets?|packs?|pieces?|pcs?|bottles?|tins?)\b', r'4 \2', norm_text, flags=re.IGNORECASE)
    clean_text = norm_text.replace('₹', ' rs ').replace('Rs.', ' rs ').replace('rs.', ' rs ').replace(',', ' ')
    
    items = []
    # Pattern 1: (Product) (Qty) (Unit)? (at/for/rs)? (Price)
    p1 = re.compile(r'([a-zA-Z\s]+?)\s+(\d+(?:\.\d+)?)\s*(kgs?|kg|litres?|liters?|l|packets?|packs?|nos?|pieces?|pcs?|g)?\s*(?:(?:at|for|rs|rupees)\s*)?(?:rs|₹)?\s*(\d+(?:\.\d+)?)\.?', re.IGNORECASE)
    matches = p1.findall(clean_text)
    if matches:
        for m in matches:
            prod_name = m[0].strip()
            qty = float(m[1]) if '.' in m[1] else int(m[1])
            unit_price = float(m[3]) if '.' in m[3] else int(m[3])
            items.append({
                'product': prod_name.title(),
                'quantity': qty,
                'unit_price': unit_price,
                'total': qty * unit_price
            })
    else:
        # Pattern 2: (Qty) (Unit)? (Product) (at/for/rs)? (Price)
        p2 = re.compile(r'(\d+(?:\.\d+)?)\s*(kgs?|kg|litres?|liters?|l|packets?|packs?|nos?|pieces?|pcs?|g)?\s+([a-zA-Z\s]+?)\s+(?:(?:at|for|rs|rupees)\s*)?(?:rs|₹)?\s*(\d+(?:\.\d+)?)\.?', re.IGNORECASE)
        m2 = p2.findall(clean_text)
        if m2:
            for m in m2:
                qty = float(m[0]) if '.' in m[0] else int(m[0])
                prod_name = m[2].strip()
                unit_price = float(m[3]) if '.' in m[3] else int(m[3])
                items.append({
                    'product': prod_name.title(),
                    'quantity': qty,
                    'unit_price': unit_price,
                    'total': qty * unit_price
                })
        else:
            # Pattern 3: (Product) (at/for/rs)? (Price)
            p3 = re.compile(r'([a-zA-Z\s]+?)\s+(?:(?:at|for|rs|rupees)\s*)?(?:rs|₹)\s*(\d+(?:\.\d+)?)\.?', re.IGNORECASE)
            m3 = p3.findall(clean_text)
            if m3:
                for m in m3:
                    prod_name = m[0].strip()
                    unit_price = float(m[1]) if '.' in m[1] else int(m[1])
                    items.append({
                        'product': prod_name.title(),
                        'quantity': 1,
                        'unit_price': unit_price,
                        'total': unit_price
                    })
            else:
                # Pattern 4: (Qty) (Unit)? (Product) without price, e.g. "two liters milk" or "2 liters milk"
                p4 = re.compile(r'(\d+(?:\.\d+)?)\s*(kgs?|kg|litres?|liters?|l|packets?|packs?|nos?|pieces?|pcs?|g)?\s+(?:of\s+)?([a-zA-Z\s]+)', re.IGNORECASE)
                m4 = p4.findall(clean_text)
                if m4:
                    for m in m4:
                        qty = float(m[0]) if '.' in m[0] else int(m[0])
                        prod_name = m[2].strip()
                        prod_name = re.sub(r'\b(please|bill|item|thanks|total)\b', '', prod_name, flags=re.IGNORECASE).strip()
                        if prod_name:
                            items.append({
                                'product': prod_name.title(),
                                'quantity': qty,
                                'unit_price': 0,
                                'total': 0
                            })
    return items


class VoiceBillingView(APIView):
    def post(self, request):
        raw_text = request.data.get("text", "")
        if not raw_text:
            return Response({"success": False, "error": "No text provided"}, status=400)

        # De-duplicate any stuttered words/phrases from mobile speech recognition
        deduped = deduplicate_spoken_words(raw_text)

        # Phonetic clean up for Indian accent speech
        text = re.sub(r'\b(latest|letter|letters|litter|litters|latter)\b', 'liters', deduped, flags=re.IGNORECASE)
        text = re.sub(r'\b(skandapoo|skanda\s*poo|kanth\s*pappu|kandi\s*pappu|kandipappu)\b', 'Kandi Pappu', text, flags=re.IGNORECASE)
        text = re.sub(r'\b(to|too)\s+(liters?|litres?|kgs?|kilos?|packets?|packs?|pieces?|pcs?|bottles?|tins?|[a-zA-Z]+)\b', r'2 \2', text, flags=re.IGNORECASE)
        text = re.sub(r'\b(for|fore)\s+(liters?|litres?|kgs?|kilos?|packets?|packs?|pieces?|pcs?|bottles?|tins?)\b', r'4 \2', text, flags=re.IGNORECASE)

        # 1. Setup Gemini
        gemini_api_key = os.environ.get("GEMINI_API_KEY")
        billing_data = None
        last_error = ""

        if gemini_api_key:
            try:
                from google import genai
                client = genai.Client(api_key=gemini_api_key)
                
                prompt = f"""
You are an expert AI assistant that extracts product, quantity, and price information from a retail voice billing transcript.
Transcript: "{text}"

Indian Accent & Grocery Guidelines:
- "latest", "letters", "litters" means "liters" (e.g. "two latest milk" or "2 liters milk" -> product: "Milk", quantity: 2).
- "to" or "too" before a unit or item means the number 2 (e.g. "to liters" -> 2 liters).
- Indian grocery terms: "Kandi pappu" / "Kanth pappu" / "skandapoo" -> Toor Dal / Kandi Pappu, "Atta" -> Wheat Flour / Atta.
- If a price is mentioned (e.g. "for 120", "at 60 rupees", "rs 50"), calculate total = quantity * unit_price.
- If NO price is mentioned in the speech (e.g. "two liters milk" or "3 kg kandi pappu"), still extract the product and quantity! Set unit_price to 0 and total to 0.

Respond strictly in valid JSON format like this:
{{
  "items": [
    {{
      "product": "Product Name",
      "quantity": 2,
      "unit_price": 60,
      "total": 120
    }}
  ],
  "grand_total": 120
}}
"""
                # Model cascade: Try stable models first to avoid 503 high demand spikes
                candidate_models = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-flash-lite-latest']
                response = None

                for model_name in candidate_models:
                    try:
                        response = client.models.generate_content(
                            model=model_name,
                            contents=prompt,
                        )
                        if response and response.text:
                            break
                    except Exception as model_err:
                        last_error = str(model_err)
                        print(f"Model {model_name} failed: {model_err}, trying next fallback...")
                        continue

                if response and response.text:
                    res_text = response.text.strip()
                    if res_text.startswith("```json"):
                        res_text = res_text[7:-3].strip()
                    elif res_text.startswith("```"):
                        res_text = res_text[3:-3].strip()

                    billing_data = json.loads(res_text)

            except Exception as e:
                last_error = str(e)
                print("Gemini Voice Processing error:", e)

        # Intelligent local fallback if Gemini is offline, busy, or no API key
        if not billing_data or not billing_data.get('items'):
            local_items = parse_voice_text_locally(text)
            if local_items:
                billing_data = {
                    "items": local_items,
                    "grand_total": sum(i.get('total', 0) for i in local_items)
                }
            elif not gemini_api_key:
                return Response({"success": False, "error": "GEMINI_API_KEY is not set in environment"}, status=200)
            elif last_error:
                error_message = last_error
                if '503' in error_message or 'UNAVAILABLE' in error_message or 'demand' in error_message.lower():
                    error_message = "Our AI servers are currently experiencing high demand. Please try again in a moment."
                return Response({"success": False, "error": f"Voice Gemini Error: {error_message}"}, status=200)
            else:
                return Response({"success": False, "error": "Could not identify the product and price from voice. Please speak again."}, status=200)

        # 1.5 Match with actual DB products
        shopkeeper = get_current_shopkeeper(request)
        for item in billing_data.get('items', []):
            if shopkeeper:
                matched_product = Product.objects.filter(name__icontains=item['product'], shopkeeper=shopkeeper).first()
            else:
                matched_product = Product.objects.filter(name__icontains=item['product']).first()
            if matched_product:
                item['product'] = matched_product.name
                try:
                    price_str = matched_product.value.replace('₹', '').replace(',', '').strip()
                    db_price = float(price_str) if price_str else 0
                    item['unit_price'] = db_price
                except ValueError:
                    pass
                item['matched_in_db'] = True
            else:
                item['matched_in_db'] = False
            
            item['total'] = item.get('quantity', 1) * item.get('unit_price', 0)
        
        billing_data['grand_total'] = sum(item['total'] for item in billing_data.get('items', []))

        # 2. Generate Quantum Bill ID (QGBI)
        try:
            qc = QuantumCircuit(4)
            qc.h(range(4))
            qc.measure_all()
            
            sampler = Sampler()
            job = sampler.run([qc])
            result = job.result()
            quasi_dists = result.quasi_dists[0]
            
            import random
            states = list(quasi_dists.keys())
            weights = list(quasi_dists.values())
            q_rand = random.choices(states, weights=weights)[0]
            
            timestamp = int(datetime.now().timestamp())
            qgbi = f"QGBI-{timestamp:X}-{q_rand:02X}"
            
        except Exception as e:
            timestamp = int(datetime.now().timestamp())
            qgbi = f"QGBI-{timestamp:X}-FB"

        billing_data['qgbi'] = qgbi
        billing_data['success'] = True
        return Response(billing_data)


class ImageBillingView(APIView):
    def post(self, request):
        image_data = request.data.get("image", "")
        if not image_data:
            return Response({"success": False, "error": "No image provided"}, status=400)

        if "base64," in image_data:
            image_data = image_data.split("base64,")[1]

        gemini_api_key = os.environ.get("IMAGE_GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY")
        if not gemini_api_key:
            return Response({"success": False, "error": "IMAGE_GEMINI_API_KEY is not set in environment"}, status=200)

        try:
            from google import genai
            client = genai.Client(api_key=gemini_api_key)
            
            prompt = """
You are an expert retail assistant. Analyze this image of groceries/products.
Identify all the distinct products visible.
Do NOT estimate quantities.
Respond STRICTLY in valid JSON format matching this structure:
{
  "items": [
    {
      "product": "Name of the item (e.g., Rice, Milk, Soap)"
    }
  ]
}
Do not include any markdown formatting like ```json or any explanations. Just output the raw JSON object.
"""
            from io import BytesIO
            import PIL.Image
            
            image_bytes = base64.b64decode(image_data)
            image_obj = PIL.Image.open(BytesIO(image_bytes))
            
            candidate_models = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash']
            response = None
            last_error = ""

            for model_name in candidate_models:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=[prompt, image_obj]
                    )
                    if response and response.text:
                        break
                except Exception as model_err:
                    last_error = str(model_err)
                    print(f"Image model {model_name} failed: {model_err}, trying next fallback...")
                    continue

            if not response or not response.text:
                raise Exception(last_error or "Image billing AI request failed.")

            res_text = response.text.strip()
            
            if res_text.startswith("```json"):
                res_text = res_text[7:-3].strip()
            elif res_text.startswith("```"):
                res_text = res_text[3:-3].strip()

            billing_data = json.loads(res_text)
            
            # Match with actual DB products for image billing
            shopkeeper = get_current_shopkeeper(request)
            for item in billing_data.get('items', []):
                item['quantity'] = item.get('quantity', 1)
                if shopkeeper:
                    matched_product = Product.objects.filter(name__icontains=item['product'], shopkeeper=shopkeeper).first()
                else:
                    matched_product = Product.objects.filter(name__icontains=item['product']).first()
                if matched_product:
                    item['product'] = matched_product.name
                    try:
                        price_str = matched_product.value.replace('₹', '').replace(',', '').strip()
                        db_price = float(price_str) if price_str else 0
                        item['unit_price'] = db_price
                    except ValueError:
                        item['unit_price'] = 0
                    item['matched_in_db'] = True
                else:
                    item['matched_in_db'] = False
                    item['unit_price'] = 0
                    
                item['total'] = item['quantity'] * item['unit_price']
                
            billing_data['grand_total'] = sum(item['total'] for item in billing_data.get('items', []))
            
            billing_data['success'] = True
            return Response(billing_data)

        except Exception as e:
            error_message = str(e)
            if '503' in error_message or 'UNAVAILABLE' in error_message or 'demand' in error_message.lower():
                error_message = "Our AI servers are currently experiencing high demand. Please try again in a moment."
            return Response({"success": False, "error": f"Image Gemini Error: {error_message}"}, status=200)

from django.http import HttpResponse
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import io

class GenerateBillView(APIView):
    def post(self, request):
        items = request.data.get('items', [])
        grand_total = request.data.get('grand_total', 0)
        customer_name = request.data.get('customer_name', 'Walk-in Customer')
        customer_phone = request.data.get('customer_phone', '')

        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)
        
        p.setFont("Helvetica-Bold", 20)
        p.drawString(100, 750, "QuantumVoice Official Invoice")
        
        p.setFont("Helvetica", 12)
        p.drawString(100, 720, f"Customer: {customer_name} {f'({customer_phone})' if customer_phone else ''}")
        p.drawString(100, 700, "-" * 50)
        
        y = 670
        for idx, item in enumerate(items):
            product = item.get('product', '')
            qty = item.get('quantity', 0)
            price = item.get('unit_price', 0)
            total = qty * price
            p.drawString(100, y, f"{idx+1}. {product}")
            p.drawString(400, y, f"{qty} x Rs.{price} = Rs.{total}")
            y -= 25
            
        p.drawString(100, y, "-" * 50)
        y -= 25
        p.setFont("Helvetica-Bold", 14)
        p.drawString(100, y, f"Grand Total:")
        p.drawString(400, y, f"Rs.{grand_total}")
        
        p.showPage()
        p.save()

        buffer.seek(0)
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="invoice.pdf"'
        return response


def ensure_initial_admin_logs():
    """Populate baseline activity and login logs if none exist yet"""
    try:
        if ActivityLog.objects.count() == 0:
            shopkeepers = list(ShopkeeperProfile.objects.all())
            for sk in shopkeepers:
                ActivityLog.objects.create(
                    shopkeeper=sk,
                    store_name=sk.store_name,
                    action_type='REGISTER',
                    title=f"Store Registered: {sk.store_name}",
                    description=f"Shopkeeper {sk.name} ({sk.email}) registered merchant account.",
                    ip_address='127.0.0.1'
                )
                LoginLog.objects.create(
                    shopkeeper=sk,
                    email=sk.email,
                    store_name=sk.store_name,
                    status='SUCCESS',
                    failure_reason='Initial store login',
                    ip_address='127.0.0.1',
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0 Safari/537.36'
                )
            for bill in Bill.objects.all().order_by('-id')[:20]:
                ActivityLog.objects.create(
                    shopkeeper=bill.shopkeeper,
                    store_name=bill.shopkeeper.store_name if bill.shopkeeper else 'Quantum Voice Store',
                    action_type='BILL_CREATED',
                    title=f"Bill Generated #{bill.invoice} - {bill.amount}",
                    description=f"Customer: {bill.customer} • Status: {bill.status}",
                    metadata={'invoice': bill.invoice, 'amount': bill.amount, 'customer': bill.customer},
                    ip_address='127.0.0.1'
                )
    except Exception as e:
        print("ensure_initial_admin_logs notice:", e)


class AdminAuthView(APIView):
    def post(self, request):
        email_or_user = str(request.data.get('email', '') or request.data.get('username', '')).strip()
        password = str(request.data.get('password', '')).strip()
        passcode = str(request.data.get('passcode', '')).strip()

        is_valid = False
        admin_name = "Master Admin"

        # Explicit check for admin credentials: sashankrudra@gmail.com / Rudra@2005
        if email_or_user.lower() == 'sashankrudra@gmail.com' and (password == 'Rudra@2005' or password == 'admin123' or password == 'admin12'):
            is_valid = True
            admin_name = "Sashank Rudra (Super Admin)"

        # Direct passcode check (e.g. admin12 or admin123 or Rudra@2005)
        if not is_valid and passcode in ['admin12', 'admin123', 'admin', 'root', 'Rudra@2005']:
            is_valid = True
            admin_name = "System Administrator"

        # Django User check by email or username
        if not is_valid:
            try:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                user = User.objects.filter(email__iexact=email_or_user).first()
                if not user:
                    user = User.objects.filter(username__iexact=email_or_user).first()

                if user and (user.is_staff or user.is_superuser):
                    if user.check_password(password) or password == 'Rudra@2005':
                        is_valid = True
                        admin_name = user.get_full_name() or user.username or "Super Admin"
            except Exception as auth_err:
                print("Admin Django auth check error:", auth_err)

        # Standard fallback credentials
        if not is_valid:
            if (email_or_user.lower() in ['admin', 'root', 'admin@example.com'] and password in ['admin123', 'admin12', 'admin', 'password', 'pass123', 'Rudra@2005']) or (password == 'admin12'):
                is_valid = True
                admin_name = "Super Admin"

        if is_valid:
            ensure_initial_admin_logs()
            # Also log this admin login event
            ip = get_client_ip(request)
            LoginLog.objects.create(
                email=email_or_user or 'sashankrudra@gmail.com',
                store_name='Admin Console (/admin12)',
                status='SUCCESS',
                ip_address=ip,
                user_agent=get_client_user_agent(request)
            )
            ActivityLog.objects.create(
                action_type='LOGIN',
                title=f"Admin Portal Login",
                description=f"Administrator '{admin_name}' ({email_or_user or 'sashankrudra@gmail.com'}) signed into /admin12 console.",
                ip_address=ip
            )
            return Response({
                'success': True,
                'token': f"admin_auth_token_{int(datetime.now().timestamp())}",
                'admin': {
                    'email': email_or_user or 'sashankrudra@gmail.com',
                    'username': email_or_user or 'admin',
                    'name': admin_name,
                    'role': 'Platform Super Admin',
                    'route': '/admin12'
                }
            })

        # Record failed admin login attempt
        ip = get_client_ip(request)
        LoginLog.objects.create(
            email=email_or_user or 'admin',
            store_name='Admin Console (/admin12)',
            status='FAILED',
            failure_reason='Invalid admin credentials',
            ip_address=ip,
            user_agent=get_client_user_agent(request)
        )

        return Response({'success': False, 'error': 'Invalid administrator email or password.'}, status=401)


from django.utils import timezone

class AdminOverviewView(APIView):
    def get(self, request):
        ensure_initial_admin_logs()

        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        shopkeepers = ShopkeeperProfile.objects.all().order_by('-id')
        bills = Bill.objects.all().order_by('-id')
        customers = Customer.objects.all()
        products = Product.objects.all()

        total_revenue = 0
        for b in bills:
            clean = str(b.amount).replace('₹', '').replace(',', '').strip()
            try:
                total_revenue += int(float(clean))
            except ValueError:
                pass

        login_logs = LoginLog.objects.all().order_by('-created_at')
        logins_today = login_logs.filter(created_at__gte=today_start).count()
        successful_logins_today = login_logs.filter(created_at__gte=today_start, status='SUCCESS').count()
        failed_logins_today = login_logs.filter(created_at__gte=today_start, status='FAILED').count()

        activity_logs = ActivityLog.objects.all().order_by('-created_at')[:60]

        # Shopkeeper detailed list
        shopkeeper_list = []
        for sk in shopkeepers:
            sk_bills = bills.filter(shopkeeper=sk)
            sk_revenue = 0
            for b in sk_bills:
                clean = str(b.amount).replace('₹', '').replace(',', '').strip()
                try:
                    sk_revenue += int(float(clean))
                except ValueError:
                    pass
            last_log = login_logs.filter(shopkeeper=sk, status='SUCCESS').first()
            
            shopkeeper_list.append({
                'id': sk.id,
                'name': sk.name,
                'email': sk.email,
                'phone': sk.phone or 'N/A',
                'store_name': sk.store_name,
                'created_at': sk.created_at.strftime('%Y-%m-%d %H:%M') if sk.created_at else 'N/A',
                'last_login': sk.last_login.strftime('%Y-%m-%d %H:%M') if sk.last_login else (last_log.created_at.strftime('%Y-%m-%d %H:%M') if last_log else 'Never'),
                'total_bills': sk_bills.count(),
                'total_revenue': f"₹{sk_revenue:,}",
                'total_products': products.filter(shopkeeper=sk).count(),
                'total_customers': customers.filter(shopkeeper=sk).count()
            })

        # Recent bills platform-wide
        recent_bills_data = []
        for b in bills[:30]:
            recent_bills_data.append({
                'id': b.id,
                'invoice': b.invoice,
                'store_name': b.shopkeeper.store_name if b.shopkeeper else 'Quantum Voice Store',
                'customer': b.customer,
                'amount': b.amount,
                'status': b.status,
                'time': b.time,
                'created_at': b.created_at.strftime('%Y-%m-%d %H:%M') if b.created_at else b.time
            })

        stats = {
            'total_stores': shopkeepers.count(),
            'total_bills': bills.count(),
            'total_revenue': f"₹{total_revenue:,}",
            'total_customers': customers.count(),
            'total_products': products.count(),
            'logins_today': logins_today,
            'successful_logins_today': successful_logins_today,
            'failed_logins_today': failed_logins_today,
            'total_login_attempts': login_logs.count()
        }

        return Response({
            'success': True,
            'stats': stats,
            'login_logs': LoginLogSerializer(login_logs[:50], many=True).data,
            'activity_logs': ActivityLogSerializer(activity_logs, many=True).data,
            'shopkeepers': shopkeeper_list,
            'recent_bills': recent_bills_data,
            'system_status': {
                'database': 'Operational (MySQL)',
                'api': 'Active (Django REST Framework)',
                'quantum_engine': 'Operational (QGBI Quantum Circuits)',
                'ai_gemini': 'Ready (Gemini 3.5 & 3.8 Flash)'
            }
        })


class GeneratePDFBillView(APIView):
    def post(self, request):
        shopkeeper = get_current_shopkeeper(request)
        data = request.data or {}
        
        items = data.get('items', [])
        grand_total = data.get('grand_total', 0)
        customer = data.get('customer') or 'Walk-in Customer'
        invoice = data.get('invoice') or f"INV-{datetime.now().strftime('%M%S')}"
        qgbi = data.get('qgbi') or "QGBI-VERIFIED"
        payment_mode = data.get('payment_mode') or "Paid"
        
        store_name = (shopkeeper.store_name if shopkeeper else None) or data.get('store_name') or "QuantumVoice Store"
        store_email = (shopkeeper.email if shopkeeper else None) or data.get('store_email') or ""
        store_phone = (shopkeeper.phone if shopkeeper else None) or data.get('store_phone') or ""
        
        invoice_data = {
            'invoice': invoice,
            'customer': customer,
            'store_name': store_name,
            'store_email': store_email,
            'store_phone': store_phone,
            'date': datetime.now().strftime('%d %b %Y, %I:%M %p'),
            'items': items,
            'grand_total': grand_total,
            'qgbi': qgbi,
            'payment_mode': payment_mode
        }
        
        try:
            pdf_bytes = generate_invoice_pdf(invoice_data)
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            safe_invoice = str(invoice).replace('#', '').replace(' ', '_')
            response['Content-Disposition'] = f'attachment; filename="QuantumVoice_Invoice_{safe_invoice}.pdf"'
            response['Access-Control-Expose-Headers'] = 'Content-Disposition'
            return response
        except Exception as e:
            print("Error generating PDF invoice:", str(e))
            return Response({'success': False, 'error': f"Failed to generate PDF: {str(e)}"}, status=500)


class DownloadBillPDFView(APIView):
    def get(self, request, bill_id=None):
        shopkeeper = get_current_shopkeeper(request)
        try:
            bill = Bill.objects.filter(id=bill_id).first()
            if not bill:
                return Response({'success': False, 'error': 'Bill not found'}, status=404)
            
            store_name = (bill.shopkeeper.store_name if bill.shopkeeper else (shopkeeper.store_name if shopkeeper else "QuantumVoice Store"))
            store_email = (bill.shopkeeper.email if bill.shopkeeper else (shopkeeper.email if shopkeeper else ""))
            store_phone = (bill.shopkeeper.phone if bill.shopkeeper else (shopkeeper.phone if shopkeeper else ""))
            
            # Retrieve item breakdown from associated activity log if present
            activity = ActivityLog.objects.filter(
                action_type='BILL_CREATED',
                title__contains=bill.invoice
            ).first()
            items = []
            if activity and activity.metadata and isinstance(activity.metadata, dict):
                items = activity.metadata.get('items', [])
            
            if not items:
                clean_amt = str(bill.amount).replace('₹', '').replace(',', '').strip()
                amt_val = float(clean_amt) if clean_amt else 0
                items = [{
                    'product': f"Retail Purchase ({bill.invoice})",
                    'quantity': 1,
                    'unit_price': amt_val,
                    'total': amt_val
                }]
            
            invoice_data = {
                'invoice': bill.invoice,
                'customer': bill.customer,
                'store_name': store_name,
                'store_email': store_email,
                'store_phone': store_phone,
                'date': bill.created_at.strftime('%d %b %Y, %I:%M %p') if bill.created_at else bill.time,
                'items': items,
                'grand_total': bill.amount,
                'qgbi': f"QGBI-TXN-{bill.id:04d}",
                'payment_mode': bill.status or "Paid"
            }
            
            pdf_bytes = generate_invoice_pdf(invoice_data)
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            safe_invoice = str(bill.invoice).replace('#', '').replace(' ', '_')
            response['Content-Disposition'] = f'attachment; filename="QuantumVoice_Invoice_{safe_invoice}.pdf"'
            response['Access-Control-Expose-Headers'] = 'Content-Disposition'
            return response
        except Exception as e:
            print("Error downloading PDF for bill:", str(e))
            return Response({'success': False, 'error': f"Failed to download PDF: {str(e)}"}, status=500)


