import io
import os
import pypdf
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from datetime import datetime


def generate_invoice_pdf(invoice_data):
    """
    Generates a professional retail invoice PDF using ReportLab and enhances metadata with PyPDF.
    
    invoice_data dict keys:
      - invoice (str): e.g. "INV-4821"
      - customer (str): Customer name
      - store_name (str): Shop / Merchant store name
      - store_email (str): Shopkeeper email
      - store_phone (str): Optional phone number
      - date (str): Formatted date string
      - items (list): List of dicts with {product, quantity, unit_price, total}
      - grand_total (float|int|str): Total amount
      - qgbi (str): Optional Quantum Bill ID
      - payment_mode (str): e.g. "UPI", "Cash", "Paid"
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'StoreTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#1e1b4b')
    )
    subtitle_style = ParagraphStyle(
        'SubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#64748b')
    )
    heading_style = ParagraphStyle(
        'InvoiceHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#4f46e5'),
        alignment=2 # Right aligned
    )
    meta_style = ParagraphStyle(
        'InvoiceMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155'),
        alignment=2 # Right aligned
    )
    label_style = ParagraphStyle(
        'Label',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#475569')
    )
    value_style = ParagraphStyle(
        'Value',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#0f172a')
    )
    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.white
    )
    cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1e293b')
    )
    cell_right_style = ParagraphStyle(
        'TableCellRight',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1e293b'),
        alignment=2
    )

    elements = []

    store_name = invoice_data.get('store_name') or "QuantumVoice Store"
    store_email = invoice_data.get('store_email') or ""
    store_phone = invoice_data.get('store_phone') or ""
    invoice_no = invoice_data.get('invoice') or "INV-0001"
    customer = invoice_data.get('customer') or "Walk-in Customer"
    date_str = invoice_data.get('date') or datetime.now().strftime('%d %b %Y, %I:%M %p')
    qgbi = invoice_data.get('qgbi') or "QGBI-VERIFIED"
    payment_mode = invoice_data.get('payment_mode') or "Paid"
    raw_total = invoice_data.get('grand_total', 0)
    if isinstance(raw_total, str):
        total_str = raw_total.replace('₹', '').replace(',', '').strip()
    else:
        total_str = str(raw_total)

    # 1. Header Section: Store Name (Left) + Invoice Metadata (Right)
    store_info_text = f"<b>{store_name}</b><br/>"
    if store_email:
        store_info_text += f"Email: {store_email}<br/>"
    if store_phone:
        store_info_text += f"Phone: {store_phone}<br/>"
    store_info_text += "Powered by QuantumVoice AI POS"

    invoice_meta_text = f"<b>TAX INVOICE</b><br/>"
    invoice_meta_text += f"<b>Invoice #:</b> {invoice_no}<br/>"
    invoice_meta_text += f"<b>Date:</b> {date_str}<br/>"
    invoice_meta_text += f"<b>Status:</b> <font color='#16a34a'><b>{payment_mode.upper()}</b></font>"

    header_table = Table(
        [
            [Paragraph(store_info_text, subtitle_style), Paragraph(invoice_meta_text, meta_style)]
        ],
        colWidths=[300, 240]
    )
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 15))

    # Divider
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0'), spaceAfter=15))

    # 2. Bill To & Quantum Verification Banner
    bill_to_text = f"<b>Billed To:</b><br/><font size='11'><b>{customer}</b></font><br/>Payment: {payment_mode}"
    qgbi_text = f"<b>Quantum Bill ID (QGBI):</b><br/><font name='Courier' size='10'>{qgbi}</font><br/><font size='7' color='#64748b'>Tamper-proof cryptographic state verification</font>"

    client_table = Table(
        [
            [Paragraph(bill_to_text, value_style), Paragraph(qgbi_text, meta_style)]
        ],
        colWidths=[270, 270]
    )
    client_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(client_table)
    elements.append(Spacer(1, 20))

    # 3. Items Table
    raw_items = invoice_data.get('items', [])
    table_data = [
        [
            Paragraph('#', table_header_style),
            Paragraph('Product Description', table_header_style),
            Paragraph('Qty', table_header_style),
            Paragraph('Unit Price (₹)', table_header_style),
            Paragraph('Total (₹)', table_header_style),
        ]
    ]

    calculated_total = 0
    for idx, itm in enumerate(raw_items, start=1):
        prod_name = itm.get('product', f'Item {idx}')
        qty = int(itm.get('quantity', 1))
        unit_price = float(itm.get('unit_price', 0))
        item_total = float(itm.get('total', qty * unit_price))
        calculated_total += item_total

        table_data.append([
            Paragraph(str(idx), cell_style),
            Paragraph(prod_name, cell_style),
            Paragraph(str(qty), cell_right_style),
            Paragraph(f"₹{unit_price:.2f}", cell_right_style),
            Paragraph(f"₹{item_total:.2f}", cell_right_style),
        ])

    final_total_display = calculated_total if calculated_total > 0 else (float(total_str) if total_str.replace('.', '', 1).isdigit() else 0)

    # Grand Total Row
    table_data.append([
        Paragraph('', cell_style),
        Paragraph('<b>GRAND TOTAL</b>', ParagraphStyle('GrandTotalLabel', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, textColor=colors.HexColor('#0f172a'))),
        Paragraph('', cell_style),
        Paragraph('', cell_style),
        Paragraph(f"<b>₹{final_total_display:.2f}</b>", ParagraphStyle('GrandTotalVal', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=12, textColor=colors.HexColor('#4f46e5'), alignment=2)),
    ])

    items_table = Table(table_data, colWidths=[30, 260, 50, 100, 100])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4f46e5')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('GRID', (0, 0), (-1, -2), 0.5, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f8fafc')]),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('LINEABOVE', (0, -1), (-1, -1), 1.5, colors.HexColor('#4f46e5')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f1f5f9')),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 25))

    # 4. Footer & Verification Note
    footer_text = f"""
    <b>Thank you for your business!</b><br/>
    For inquiries or support, please contact {store_name}.<br/>
    <font color='#6366f1'><b>QuantumVoice AI POS</b></font> • Powered by Qiskit Quantum Circuits & ReportLab Engine
    """
    elements.append(Paragraph(footer_text, ParagraphStyle('Footer', parent=styles['Normal'], fontName='Helvetica', fontSize=8, leading=11, textColor=colors.HexColor('#64748b'), alignment=1)))

    # Build PDF with ReportLab
    doc.build(elements)
    buf.seek(0)

    # 5. Process and enhance with PyPDF (Metadata & Page Integrity)
    reader = pypdf.PdfReader(buf)
    writer = pypdf.PdfWriter()

    for page in reader.pages:
        writer.add_page(page)

    writer.add_metadata({
        '/Title': f"Invoice {invoice_no} - {store_name}",
        '/Author': store_name,
        '/Subject': f"QuantumVoice Verified Retail Invoice for {customer}",
        '/Creator': "QuantumVoice AI Billing Engine (ReportLab & PyPDF)",
        '/Producer': "QuantumVoice AI QGBI POS",
        '/Keywords': f"Invoice, {invoice_no}, {qgbi}, Retail, Billing"
    })

    out_buf = io.BytesIO()
    writer.write(out_buf)
    out_buf.seek(0)
    return out_buf.getvalue()
