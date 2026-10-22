# QuantumVoice - AI Billing & Store Management System

QuantumVoice is an AI-powered billing and store management application designed for modern retail shopkeepers. It streamlines checkout workflows through multi-modal input channels (Voice, Image/Receipt OCR, and Barcode Scanning) while providing a live, isolated multi-tenant management dashboard.

---

## 🚀 Key Features

- **Multi-Modal AI Billing**:
  - **Voice Billing**: Speak customer orders naturally in English, Hindi, or Telugu; AI parses spoken items, quantities, and prices automatically.
  - **Image Billing**: Upload or capture photos of handwritten bills or physical receipts for instant invoice generation.
  - **Barcode Billing**: Fast camera or scanner-based barcode checkout with automatic inventory lookup.
- **Shopkeeper Management & Multi-Tenancy**:
  - Store isolation: each registered store maintains its own isolated catalog, customers, invoices, and analytics.
  - Secure authentication with store profile settings and session state management.
- **Bill History & Invoicing**:
  - Full invoice tracking with search, payment status filters (Paid/Pending), and detailed receipt modal views.
- **Real-Time Analytics Dashboard**:
  - Live revenue monitoring, hourly breakdown charts, top-selling products, and recent customer activity.

---

## 🛠 Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts, Sonner.
- **Backend**: Python 3.11, Django, Django REST Framework, Django CORS Headers.
- **Database**: MySQL (`quantumvoice_db`).
- **AI & Processing**: Multimodal voice parsing, image receipt recognition, dynamic invoice processing.

---

## 📦 Project Structure

```text
quantumvoice-dashboard/
├── backend/
│   ├── api/             # Django REST API (views, models, serializers, migrations)
│   ├── core/            # Django project settings and routing
│   └── manage.py        # Django CLI
├── frontend/
│   ├── src/             # React application source code
│   │   ├── components/  # View modules (Voice, Image, Barcode, Bills, Products, Customers)
│   │   ├── pages/       # Home and Login pages
│   │   └── App.tsx      # Main application router and auth context
│   ├── package.json     # Node.js dependencies and scripts
│   └── vite.config.ts   # Vite configuration
└── README.md
```

---

## ⚡ Getting Started

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```
Backend runs on `http://127.0.0.1:8000/`.

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:3000/`.

---

## 📄 License
MIT License. Created by [sashankrudra-creator](https://github.com/sashankrudra-creator).
