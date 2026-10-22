from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DashboardDataView, LoginView, RegisterView, UpdateProfileView, CustomerViewSet, ProductViewSet, BillViewSet, VoiceBillingView, ImageBillingView, GenerateBillView

router = DefaultRouter()
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'bills', BillViewSet, basename='bill')


urlpatterns = [
    path('dashboard-data/', DashboardDataView.as_view(), name='dashboard-data'),
    path('login/', LoginView.as_view(), name='login'),
    path('register/', RegisterView.as_view(), name='register'),
    path('update-profile/', UpdateProfileView.as_view(), name='update-profile'),
    path('voice-billing/', VoiceBillingView.as_view(), name='voice-billing'),
    path('image-billing/', ImageBillingView.as_view(), name='image-billing'),
    path('generate-bill/', GenerateBillView.as_view(), name='generate-bill'),
    path('', include(router.urls)),
]
