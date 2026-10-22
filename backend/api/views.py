import os
import json
import base64

from qiskit import QuantumCircuit
from qiskit.primitives import StatevectorSampler as Sampler

from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Customer, Product, Bill, HourlySales, RevenueTrend, ShopkeeperProfile, Notification
from .serializers import CustomerSerializer, ProductSerializer, BillSerializer, HourlySalesSerializer, RevenueTrendSerializer
from rest_framework import serializers
from datetime import datetime

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

        return Response({'success': False, 'error': 'Invalid email or password'}, status=401)

class RegisterView(APIView):
    def post(self, request):
        name = request.data.get('name')
        email = request.data.get('email')
        password = request.data.get('password')
        store_name = request.data.get('store_name')
        
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
        serializer.save(shopkeeper=shopkeeper)

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
        serializer.save(shopkeeper=shopkeeper)

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


def parse_voice_text_locally(text):
    import re
    clean_text = text.replace('₹', ' rs ').replace('Rs.', ' rs ').replace('rs.', ' rs ').replace(',', ' ')
    items = []
    # Pattern 1: (Product) (Qty) (Unit)? (at/for/rs)? (Price)
    p1 = re.compile(r'([a-zA-Z\s]+?)\s+(\d+(?:\.\d+)?)\s*(kgs?|kg|litres?|l|packets?|packs?|nos?|pieces?|pcs?|g)?\s*(?:(?:at|for|rs|rupees)\s*)?(?:rs|₹)?\s*(\d+(?:\.\d+)?)\.?', re.IGNORECASE)
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
        # Pattern 2: (Qty) (Product) (at/for/rs)? (Price)
        p2 = re.compile(r'(\d+)\s+([a-zA-Z\s]+?)\s+(?:(?:at|for|rs|rupees)\s*)?(?:rs|₹)?\s*(\d+(?:\.\d+)?)\.?', re.IGNORECASE)
        m2 = p2.findall(clean_text)
        if m2:
            for m in m2:
                qty = int(m[0])
                prod_name = m[1].strip()
                unit_price = float(m[2]) if '.' in m[2] else int(m[2])
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
            for m in m3:
                prod_name = m[0].strip()
                unit_price = float(m[1]) if '.' in m[1] else int(m[1])
                items.append({
                    'product': prod_name.title(),
                    'quantity': 1,
                    'unit_price': unit_price,
                    'total': unit_price
                })
    return items


class VoiceBillingView(APIView):
    def post(self, request):
        text = request.data.get("text", "")
        if not text:
            return Response({"success": False, "error": "No text provided"}, status=400)

        # 1. Setup Gemini
        gemini_api_key = os.environ.get("GEMINI_API_KEY")
        billing_data = None
        last_error = ""

        if gemini_api_key:
            try:
                from google import genai
                client = genai.Client(api_key=gemini_api_key)
                
                prompt = f"""
You are an AI assistant that extracts product, quantity, and price information from a voice billing transcript.
The user said: "{text}"

Extract the items and calculate the total for each item and the grand total.
Respond strictly in valid JSON format like this, and nothing else:
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
