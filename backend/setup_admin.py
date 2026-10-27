import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

# Create or update superuser with sashankrudra@gmail.com
admin_email = 'sashankrudra@gmail.com'
admin_pass = 'Rudra@2005'

user = User.objects.filter(email__iexact=admin_email).first()
if not user:
    user = User.objects.filter(username='admin').first()

if not user:
    user = User.objects.create(username='sashankrudra', email=admin_email)
else:
    user.email = admin_email
    if not user.username:
        user.username = 'sashankrudra'

user.set_password(admin_pass)
user.is_staff = True
user.is_superuser = True
user.save()

print(f"Admin user successfully configured: {user.email} (Username: {user.username})")
