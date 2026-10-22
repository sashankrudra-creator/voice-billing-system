import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

# Create or update superuser
user, created = User.objects.get_or_create(username='admin', email='admin@example.com')
user.set_password('admin123')
user.is_staff = True
user.is_superuser = True
user.save()

print("Admin user configured successfully.")
