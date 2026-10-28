import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Camera, Image as ImageIcon, Loader2, Sparkles, Send, CheckCircle2, AlertCircle, Trash2, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import QRCode from "react-qr-code";
import { useAuth } from "../App";
import PaymentModal from "./PaymentModal";
import { API_BASE_URL } from "../apiConfig";

export default function ImageBilling() {
  const { shopkeeper } = useAuth();
  const [image, setImage] = useState<string | null>(() => sessionStorage.getItem('imageBilling_image') || null);
  const [processing, setProcessing] = useState(false);
  const [items, setItems] = useState<any[]>(() => {
      const saved = sessionStorage.getItem('imageBilling_items');
      return saved ? JSON.parse(saved) : [];
  });
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  
  // WhatsApp Modal State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [billCustomerName, setBillCustomerName] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      if (image) {
          sessionStorage.setItem('imageBilling_image', image);
      } else {
          sessionStorage.removeItem('imageBilling_image');
      }
  }, [image]);

  useEffect(() => {
      sessionStorage.setItem('imageBilling_items', JSON.stringify(items));
  }, [items]);

  const handleClear = () => {
      setImage(null);
      setItems([]);
      sessionStorage.removeItem('imageBilling_image');
      sessionStorage.removeItem('imageBilling_items');
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setItems([]);
        setError("");
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async () => {
    if (!image) return;
    setProcessing(true);
    setError("");
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/image-billing/`, {
        image: image,
        shopkeeper_email: shopkeeper?.email
      });
      
      if (response.data && response.data.success) {
          // Initialize empty quantity and price for shopkeeper to fill
          const newItems = response.data.items.map((item: any) => ({
              ...item,
              quantity: 1,
              unit_price: 0
          }));
          setItems(newItems);
          toast.success("Products extracted successfully!");
      } else {
          setError(response.data.error || "Failed to analyze image.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Could not extract products from the image.");
    } finally {
      setProcessing(false);
    }
  };

  const handleItemChange = (index: number, field: string, value: number) => {
      const updatedItems = [...items];
      updatedItems[index][field] = value;
      setItems(updatedItems);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number, field: 'quantity' | 'unit_price') => {
      if (e.key === 'Enter') {
          e.preventDefault();
          if (field === 'quantity') {
              const nextInput = document.getElementById(`price-${index}`);
              nextInput?.focus();
          } else {
              const nextInput = document.getElementById(`qty-${index + 1}`);
              nextInput?.focus();
          }
      }
  };

  const calculateGrandTotal = () => {
      return items.reduce((total, item) => total + (item.quantity * item.unit_price), 0);
  };

  const sendToWhatsApp = () => {
      const grandTotal = calculateGrandTotal();
      if (grandTotal <= 0) {
          toast.error("Please add prices to the products before sending.");
          return;
      }
      
      // Fetch customers and show modal
      axios.get(`${API_BASE_URL}/api/customers/`)
          .then(res => setCustomers(res.data))
          .catch(err => console.error("Error fetching customers", err));
          
      setShowWhatsAppModal(true);
  };

  const handleSendWhatsAppMessage = async () => {
      let phone = "";
      if (selectedCustomer) {
          phone = selectedCustomer.phone;
      } else if (newCustomerPhone) {
          phone = newCustomerPhone;
          if (newCustomerName) {
              try {
                  await axios.post(`${API_BASE_URL}/api/customers/`, {
                      name: newCustomerName,
                      phone: newCustomerPhone,
                      initials: newCustomerName.substring(0, 2).toUpperCase(),
                      tone: "violet",
                  });
              } catch (e) {
                  console.error("Could not save customer", e);
              }
          }
      } else {
          toast.error("Please select a customer or enter a phone number.");
          return;
      }

      const formattedPhone = phone.replace(/\D/g, '');
      const finalPhone = formattedPhone.length === 10 ? `91${formattedPhone}` : formattedPhone;

      const grandTotal = calculateGrandTotal();
      
      let message = "*🛍️ QuantumVoice Invoice*\n\n";
      items.forEach((item, index) => {
          message += `${index + 1}. ${item.product}\n`;
          message += `    Qty: ${item.quantity} x ₹${item.unit_price} = ₹${item.quantity * item.unit_price}\n`;
      });
      message += `\n*Grand Total: ₹${grandTotal}*\n`;
      
      message += "\n*💳 Payment Options:*\n";
      message += `1. Click to pay: upi://pay?pa=quantumvoice@upi&pn=QuantumVoice&am=${grandTotal}&cu=INR\n`;
      message += "2. Or copy UPI ID: quantumvoice@upi\n";
      
      message += "\nThank you for shopping with us!";

      const whatsappUrl = `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      
      setShowWhatsAppModal(false);
  };

  const handleCompleteSale = () => {
      const grandTotal = calculateGrandTotal();
      if (grandTotal <= 0) {
          toast.error("Please add prices before completing the sale.");
          return;
      }
      setShowPaymentModal(true);
  };

  const handleConfirmPayment = async (paymentMode: "Cash" | "UPI") => {
      const grandTotal = calculateGrandTotal();
      const invoiceNumber = `INV-${Math.floor(1000 + Math.random() * 9000)}`;
      const customerNameToSave = billCustomerName.trim() || "Walk-in Customer";
      const customerInitials = billCustomerName.trim() ? billCustomerName.trim().substring(0, 2).toUpperCase() : "WC";

      try {
          await axios.post(`${API_BASE_URL}/api/bills/`, {
              invoice: invoiceNumber,
              customer: customerNameToSave,
              amount: `₹${grandTotal}`,
              time: "Just now",
              status: "Paid",
              initials: customerInitials,
              tone: "emerald",
              items: items,
              shopkeeper_email: shopkeeper?.email
          });
          
          toast.success(`Sale completed via ${paymentMode}! Invoice #${invoiceNumber}`);
          setBillCustomerName("");
          handleClear();
      } catch (err) {
          console.error("Failed to complete sale", err);
          toast.error("Failed to record the sale.");
          throw err;
      }
  };

  const handleDownloadPDF = async () => {
      const grandTotal = calculateGrandTotal();
      if (items.length === 0) {
          toast.error("No items in bill to download.");
          return;
      }
      setIsDownloadingPDF(true);
      try {
          const invoiceNo = `INV-${Math.floor(1000 + Math.random() * 9000)}`;
          const response = await axios.post(
              `${API_BASE_URL}/api/generate-pdf-bill/`,
              {
                  invoice: invoiceNo,
                  customer: billCustomerName.trim() || "Walk-in Customer",
                  items: items,
                  grand_total: grandTotal,
                  qgbi: "QGBI-IMG-VERIFIED",
                  payment_mode: "Pending / Draft",
                  store_name: shopkeeper?.store_name,
                  store_email: shopkeeper?.email,
                  store_phone: shopkeeper?.phone,
                  shopkeeper_email: shopkeeper?.email
              },
              { responseType: "blob" }
          );

          const blob = new Blob([response.data], { type: "application/pdf" });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `QuantumVoice_Invoice_${invoiceNo}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
          toast.success("PDF Invoice downloaded successfully!");
      } catch (err) {
          console.error("Failed to generate PDF invoice", err);
          toast.error("Could not generate PDF. Please try again.");
      } finally {
          setIsDownloadingPDF(false);
      }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-36 sm:pb-12">
        <div className="flex flex-col items-center rounded-2xl sm:rounded-3xl border border-indigo-100 bg-white p-5 sm:p-10 shadow-xl shadow-indigo-100/40">
            
            <div className="mb-6 flex flex-col items-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-lg shadow-indigo-500/30">
                    <Camera className="h-8 w-8" />
                </div>
                <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">Image Billing</h2>
                <p className="mt-2 text-sm text-slate-500 max-w-md">
                    Snap a photo of the groceries. AI will identify the products, and you can fill in the prices!
                </p>
            </div>

            {error && (
                <div className="mb-6 flex w-full max-w-2xl items-center gap-3 rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-700">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            <div className="w-full max-w-2xl space-y-6">
                {!image ? (
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-12 transition hover:bg-indigo-50 hover:border-indigo-300"
                    >
                        <ImageIcon className="mb-4 h-12 w-12 text-indigo-400" />
                        <h3 className="text-lg font-bold text-slate-700">Upload or Take Photo</h3>
                        <p className="text-sm text-slate-500">Click to browse your device</p>
                        <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment"
                            className="hidden" 
                            ref={fileInputRef} 
                            onChange={handleImageUpload} 
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center space-y-4">
                        <div className="relative overflow-hidden rounded-2xl border-4 border-slate-100 shadow-lg">
                            <img src={image} alt="Groceries" className="max-h-80 w-auto object-cover" />
                            <button 
                                onClick={handleClear}
                                className="absolute right-2 top-2 rounded-full bg-slate-900/60 p-2 text-white backdrop-blur-md transition hover:bg-rose-500"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>

                        {items.length === 0 && (
                            <div className="flex w-full gap-3">
                                <button 
                                    onClick={handleClear}
                                    disabled={processing}
                                    className="flex w-1/3 items-center justify-center gap-2 rounded-xl bg-slate-100 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
                                >
                                    <Trash2 className="h-4 w-4" /> Retake
                                </button>
                                <button 
                                    onClick={processImage}
                                    disabled={processing}
                                    className="flex w-2/3 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:opacity-90 disabled:opacity-50"
                                >
                                    {processing ? (
                                        <><Loader2 className="h-5 w-5 animate-spin" /> Analyzing Image...</>
                                    ) : (
                                        <><Sparkles className="h-5 w-5" /> Extract Products</>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>

        {items.length > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-2xl sm:rounded-3xl border border-emerald-100 bg-white p-4 sm:p-8 shadow-xl shadow-emerald-100/50">
                <div className="mb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-900">Billing Setup</h3>
                            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Products Extracted
                            </span>
                        </div>
                        <p className="mt-1 text-xs sm:text-sm text-slate-500">Fill in the quantity and unit price for each item.</p>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl sm:rounded-2xl border border-slate-200 mb-6">
                    <table className="w-full text-left min-w-[340px]">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-3 py-3 sm:px-6 sm:py-4 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">Product</th>
                                <th className="px-2 py-3 sm:px-6 sm:py-4 w-20 sm:w-32 text-center sm:text-right text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">Qty</th>
                                <th className="px-2 py-3 sm:px-6 sm:py-4 w-24 sm:w-40 text-center sm:text-right text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">Unit Price (₹)</th>
                                <th className="px-3 py-3 sm:px-6 sm:py-4 w-20 sm:w-32 text-right text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">Total (₹)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((item: any, i: number) => (
                                <tr key={i} className={`transition ${item.matched_in_db === false ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50/50'}`}>
                                    <td className="px-3 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm font-semibold text-slate-800">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                            <span>{item.product}</span>
                                            {item.matched_in_db === false && (
                                                <span className="self-start inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 uppercase" title="Not found in database.">
                                                    <AlertCircle className="h-3 w-3" /> New
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-2 py-3 sm:px-6 sm:py-4 text-center sm:text-right">
                                        <input 
                                            id={`qty-${i}`}
                                            type="number" 
                                            min="1"
                                            value={item.quantity || ''}
                                            onChange={(e) => handleItemChange(i, 'quantity', parseInt(e.target.value) || 0)}
                                            onKeyDown={(e) => handleKeyDown(e, i, 'quantity')}
                                            className="w-14 sm:w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center sm:text-right text-xs sm:text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                    </td>
                                    <td className="px-2 py-3 sm:px-6 sm:py-4 text-center sm:text-right">
                                        <input 
                                            id={`price-${i}`}
                                            type="number" 
                                            min="0"
                                            value={item.unit_price || ''}
                                            onChange={(e) => handleItemChange(i, 'unit_price', parseInt(e.target.value) || 0)}
                                            onKeyDown={(e) => handleKeyDown(e, i, 'unit_price')}
                                            className="w-16 sm:w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center sm:text-right text-xs sm:text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                    </td>
                                    <td className="px-3 py-3 sm:px-6 sm:py-4 text-right text-xs sm:text-sm font-bold text-slate-900 whitespace-nowrap">
                                        ₹{(item.quantity * item.unit_price) || 0}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-900 text-white">
                            <tr>
                                <td colSpan={3} className="px-3 py-3 sm:px-6 sm:py-4 text-right text-xs sm:text-sm font-bold uppercase tracking-wider">Grand Total</td>
                                <td className="px-3 py-3 sm:px-6 sm:py-4 text-right text-base sm:text-lg font-black text-emerald-400 whitespace-nowrap">₹{calculateGrandTotal()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="mb-6 rounded-xl sm:rounded-2xl bg-slate-50 p-4 sm:p-5">
                    <label className="block text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Customer Name (Optional)</label>
                    <input 
                        type="text" 
                        placeholder="Leave blank for Walk-in Customer" 
                        value={billCustomerName} 
                        onChange={(e) => setBillCustomerName(e.target.value)} 
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100/70" 
                    />
                </div>

                <div className="grid grid-cols-2 sm:flex sm:justify-end gap-2 sm:gap-3">
                    <button 
                        onClick={handleClear}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-bold text-rose-600 shadow-sm transition hover:bg-rose-100 active:scale-[0.98]"
                    >
                        <Trash2 className="h-4 w-4" /> Clear
                    </button>
                    <button 
                        onClick={() => setShowPreview(true)}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-indigo-600 active:scale-[0.98]"
                    >
                        <Eye className="h-4 w-4" /> Preview
                    </button>
                    <button 
                        onClick={handleDownloadPDF}
                        disabled={isDownloadingPDF}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-bold text-violet-700 shadow-sm transition hover:bg-violet-100 active:scale-[0.98] disabled:opacity-50"
                    >
                        {isDownloadingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PDF
                    </button>
                    <button 
                        onClick={sendToWhatsApp}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-[#25D366]/30 transition hover:bg-[#20bd5a] active:scale-[0.98]"
                    >
                        <Send className="h-4 w-4" /> WhatsApp
                    </button>
                    <button 
                        onClick={handleCompleteSale}
                        className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-3 sm:px-6 sm:py-3.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-700 active:scale-[0.98]"
                    >
                        <CheckCircle2 className="h-4 w-4" /> Complete Sale
                    </button>
                </div>
            </div>
        )}

        {showPreview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                    <button 
                        onClick={() => setShowPreview(false)}
                        className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                        ✕
                    </button>
                    
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-black text-slate-900">QuantumVoice</h2>
                        <p className="text-sm font-medium text-slate-500">Official Invoice</p>
                    </div>

                    <div className="mb-6 space-y-2 border-b border-dashed border-slate-200 pb-6 text-sm text-slate-600">
                        {items.map((item, i) => (
                            <div key={i} className="flex justify-between">
                                <span>{item.quantity}x {item.product}</span>
                                <span>₹{item.quantity * item.unit_price}</span>
                            </div>
                        ))}
                    </div>

                    <div className="mb-8 flex justify-between text-lg font-black text-slate-900">
                        <span>Grand Total</span>
                        <span className="text-emerald-600">₹{calculateGrandTotal()}</span>
                    </div>

                    <div className="flex flex-col items-center justify-center space-y-3 rounded-2xl bg-slate-50 p-6">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Scan to Pay / Verify</p>
                        <div className="rounded-xl bg-white p-3 shadow-sm border border-slate-100">
                            <QRCode 
                                value={`UPI ID: quantumvoice@upi | Total: ₹${calculateGrandTotal()}`}
                                size={120}
                                level="M"
                            />
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setShowPreview(false)}
                        className="mt-6 w-full rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 active:scale-[0.98]"
                    >
                        Close Preview
                    </button>
                </div>
            </div>
        )}

        {showWhatsAppModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="relative w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                    <button 
                        onClick={() => setShowWhatsAppModal(false)}
                        className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                        ✕
                    </button>
                    
                    <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                        <Send className="h-5 w-5 text-[#25D366]" /> Send via WhatsApp
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Existing Customer</label>
                            <select 
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:bg-white"
                                onChange={(e) => {
                                    const c = customers.find(cust => cust.id.toString() === e.target.value);
                                    setSelectedCustomer(c || null);
                                    if (c) {
                                        setNewCustomerPhone("");
                                        setNewCustomerName("");
                                    }
                                }}
                                value={selectedCustomer?.id || ""}
                            >
                                <option value="">-- Choose Customer --</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                                ))}
                            </select>
                        </div>

                        <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-slate-200"></div>
                            <span className="flex-shrink-0 mx-4 text-xs font-medium text-slate-400">OR ENTER NEW</span>
                            <div className="flex-grow border-t border-slate-200"></div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">New Phone Number *</label>
                            <input 
                                type="text"
                                placeholder="e.g. 9876543210"
                                value={newCustomerPhone}
                                disabled={!!selectedCustomer}
                                onChange={(e) => setNewCustomerPhone(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:bg-white disabled:opacity-50"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Customer Name (Optional)</label>
                            <input 
                                type="text"
                                placeholder="Name to save"
                                value={newCustomerName}
                                disabled={!!selectedCustomer}
                                onChange={(e) => setNewCustomerName(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:bg-white disabled:opacity-50"
                            />
                            <p className="mt-1.5 text-[10px] text-slate-400">If you provide a name, this contact will be saved.</p>
                        </div>
                    </div>

                    <button 
                        onClick={handleSendWhatsAppMessage}
                        className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#25D366]/30 transition hover:bg-[#20bd5a] active:scale-[0.98]"
                    >
                        Send Invoice
                    </button>
                </div>
            </div>
        )}

        {/* Payment Method Modal (Matches Phone 2 & 3 in screenshot) */}
        <PaymentModal
            isOpen={showPaymentModal}
            onClose={() => setShowPaymentModal(false)}
            customerName={billCustomerName || "Walk-in Customer"}
            totalAmount={calculateGrandTotal()}
            onConfirm={handleConfirmPayment}
            storeName={shopkeeper?.store_name}
        />
    </div>
  );
}
