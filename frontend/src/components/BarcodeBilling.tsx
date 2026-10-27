import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Html5Qrcode } from "html5-qrcode";
import { BrowserMultiFormatReader } from "@zxing/library";
import { ScanLine, Trash2, Send, CheckCircle2, AlertCircle, Upload, Image as ImageIcon, Crop as CropIcon } from "lucide-react";
import { toast } from "sonner";
import QRCode from "react-qr-code";
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useAuth } from "../App";
import PaymentModal from "./PaymentModal";
import { API_BASE_URL } from "../apiConfig";

export default function BarcodeBilling() {
  const { shopkeeper } = useAuth();
  const [items, setItems] = useState<any[]>(() => {
      const saved = sessionStorage.getItem('barcodeBilling_items');
      return saved ? JSON.parse(saved) : [];
  });
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [autoResumeCamera, setAutoResumeCamera] = useState(false);
  
  // Cropping State
  const [imgSrc, setImgSrc] = useState("");
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  
  // New Product Modal State
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [newBarcode, setNewBarcode] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");

  // WhatsApp Modal State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [billCustomerName, setBillCustomerName] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
      sessionStorage.setItem('barcodeBilling_items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
      let html5QrCode: Html5Qrcode | null = null;
      
      if (scanning) {
          html5QrCode = new Html5Qrcode("reader");
          
          html5QrCode.start(
              { facingMode: "user" }, // "user" forces front camera/webcam
              {
                  fps: 10,
                  // Removed qrbox to allow scanning the entire frame, much easier for laptops
              },
              onScanSuccess,
              onScanFailure
          ).catch(err => {
              console.error("Front camera failed, trying environment", err);
              html5QrCode?.start(
                  { facingMode: "environment" },
                  { fps: 10 },
                  onScanSuccess,
                  onScanFailure
              ).catch(e => {
                  toast.error("Could not start camera.");
                  setScanning(false);
              });
          });
      }

      return () => {
          if (html5QrCode && html5QrCode.isScanning) {
              html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
          }
      };
  }, [scanning]);

  const playBeep = () => {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.value = 800;
      gainNode.gain.setValueAtTime(1, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.1);
      
      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.1);
  };

  const onScanSuccess = async (decodedText: string, resumeCamera: boolean = true) => {
      // Pause scanning momentarily
      if (resumeCamera) setScanning(false);
      setAutoResumeCamera(resumeCamera);
      playBeep();
      if (navigator.vibrate) navigator.vibrate(100);

      try {
          const response = await axios.get(`${API_BASE_URL}/api/products/?barcode=${decodedText}`, {
              params: { shopkeeper_email: shopkeeper?.email }
          });
          if (response.data && response.data.length > 0) {
              const product = response.data[0];
              const priceStr = product.value.replace('₹', '').replace(',', '');
              const price = parseInt(priceStr) || 0;
              
              setItems(prev => {
                  const existing = prev.find(i => i.product === product.name);
                  if (existing) {
                      return prev.map(i => i.product === product.name ? { ...i, quantity: i.quantity + 1 } : i);
                  } else {
                      return [...prev, { product: product.name, quantity: 1, unit_price: price }];
                  }
              });
              toast.success(`Added ${product.name}`);
              // Resume scanning
              if (resumeCamera) setTimeout(() => setScanning(true), 1500);
          } else {
              setNewBarcode(decodedText);
              setShowNewProductModal(true);
          }
      } catch (err) {
          console.error("Failed to look up barcode", err);
          toast.error("Error looking up product.");
          if (resumeCamera) setTimeout(() => setScanning(true), 1500);
      }
  };

  const onScanFailure = (error: any) => {
      // ignore frame errors
  };

  const handleCaptureFrame = () => {
      const video = document.querySelector('#reader video') as HTMLVideoElement;
      if (video) {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/png');
              setScanning(false); // Stop camera momentarily
              setAutoResumeCamera(true); 
              setCrop(undefined);
              setCompletedCrop(undefined);
              setImgSrc(dataUrl);
          }
      } else {
          toast.error("Camera feed not found. Please wait for the camera to start.");
      }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setCrop(undefined);
      setCompletedCrop(undefined);
      const reader = new FileReader();
      reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
      reader.readAsDataURL(file);
      
      e.target.value = "";
  };

  const handleCropComplete = async () => {
      if (imgRef.current && completedCrop?.width && completedCrop?.height) {
          const canvas = document.createElement('canvas');
          const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
          const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
          
          // Use the actual high-resolution pixel dimensions for the canvas
          canvas.width = Math.floor(completedCrop.width * scaleX);
          canvas.height = Math.floor(completedCrop.height * scaleY);
          
          const ctx = canvas.getContext('2d');

          if (ctx) {
              // Enable high quality image smoothing
              ctx.imageSmoothingQuality = "high";
              
              ctx.drawImage(
                  imgRef.current,
                  completedCrop.x * scaleX,
                  completedCrop.y * scaleY,
                  completedCrop.width * scaleX,
                  completedCrop.height * scaleY,
                  0,
                  0,
                  canvas.width,
                  canvas.height
              );
              
              // 1. Try native BarcodeDetector API first (better at angles & 1D barcodes)
              if ('BarcodeDetector' in window) {
                  try {
                      // @ts-ignore
                      const barcodeDetector = new window.BarcodeDetector();
                      const barcodes = await barcodeDetector.detect(canvas);
                      if (barcodes && barcodes.length > 0) {
                          onScanSuccess(barcodes[0].rawValue, false);
                          setImgSrc("");
                          return;
                      }
                  } catch (e) {
                      console.error("Native BarcodeDetector failed", e);
                  }
              }
              
              // 2. Fallback to ZXing
              canvas.toBlob(async (blob) => {
                  if (blob) {
                      try {
                          const reader = new BrowserMultiFormatReader();
                          const imageUrl = URL.createObjectURL(blob);
                          const result = await reader.decodeFromImageUrl(imageUrl);
                          
                          URL.revokeObjectURL(imageUrl);
                          onScanSuccess(result.getText(), false);
                          setImgSrc(""); // Close crop modal
                      } catch (err) {
                          console.error("Error scanning cropped image with ZXing:", err);
                          toast.error("Could not find barcode in the selected region.");
                      }
                  }
              });
          }
      } else {
          // If no crop selection, try scanning the whole image
          if (imgRef.current && 'BarcodeDetector' in window) {
              try {
                  // @ts-ignore
                  const barcodeDetector = new window.BarcodeDetector();
                  const barcodes = await barcodeDetector.detect(imgRef.current);
                  if (barcodes && barcodes.length > 0) {
                      onScanSuccess(barcodes[0].rawValue, false);
                      setImgSrc("");
                      return;
                  }
              } catch (e) {
                  console.error("Native BarcodeDetector full image failed", e);
              }
          }

          try {
              const reader = new BrowserMultiFormatReader();
              const result = await reader.decodeFromImageUrl(imgSrc);
              onScanSuccess(result.getText(), false);
              setImgSrc("");
          } catch(err) {
               toast.error("Could not find barcode in the image. Please try selecting the barcode area.");
          }
      }
  };

  const handleSaveNewProduct = async () => {
      if (!newProductName || !newProductPrice) {
          toast.error("Please enter name and price.");
          return;
      }
      
      try {
          await axios.post(`${API_BASE_URL}/api/products/`, {
              name: newProductName,
              barcode: newBarcode,
              sold: "0 sold",
              value: `₹${newProductPrice}`,
              width: "0%",
              color: "bg-slate-500",
              shopkeeper_email: shopkeeper?.email
          });
          
          setItems(prev => [...prev, { product: newProductName, quantity: 1, unit_price: parseInt(newProductPrice) }]);
          toast.success("Product saved and added to bill!");
          
          setShowNewProductModal(false);
          setNewProductName("");
          setNewProductPrice("");
          if (autoResumeCamera) setScanning(true);
      } catch (err) {
          console.error(err);
          toast.error("Failed to save product.");
      }
  };

  const handleClear = () => {
      setItems([]);
      sessionStorage.removeItem('barcodeBilling_items');
  };

  const handleItemChange = (index: number, field: string, value: number) => {
      const updatedItems = [...items];
      updatedItems[index][field] = value;
      setItems(updatedItems);
  };

  const calculateGrandTotal = () => {
      return items.reduce((total, item) => total + (item.quantity * item.unit_price), 0);
  };

  const sendToWhatsApp = () => {
      const grandTotal = calculateGrandTotal();
      if (grandTotal <= 0) {
          toast.error("Please add products before sending.");
          return;
      }
      axios.get(`${API_BASE_URL}/api/customers/`)
          .then(res => setCustomers(res.data))
          .catch(err => console.error("Error fetching customers", err));
      setShowWhatsAppModal(true);
  };

  const handleSendWhatsAppMessage = async () => {
      let phone = "";
      if (selectedCustomer) phone = selectedCustomer.phone;
      else if (newCustomerPhone) {
          phone = newCustomerPhone;
          if (newCustomerName) {
              try {
                  await axios.post(`${API_BASE_URL}/api/customers/`, {
                      name: newCustomerName,
                      phone: newCustomerPhone,
                      initials: newCustomerName.substring(0, 2).toUpperCase(),
                      tone: "violet",
                  });
              } catch (e) { console.error("Could not save customer", e); }
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
      message += "2. Or copy UPI ID: quantumvoice@upi\n\nThank you for shopping with us!";

      const whatsappUrl = `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      setShowWhatsAppModal(false);
  };

  const handleCompleteSale = () => {
      const grandTotal = calculateGrandTotal();
      if (grandTotal <= 0) {
          toast.error("Please add products before completing the sale.");
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col items-center rounded-3xl border border-indigo-100 bg-white p-10 shadow-xl shadow-indigo-100/40">
            <div className="mb-6 flex flex-col items-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-lg shadow-indigo-500/30">
                    <ScanLine className="h-8 w-8" />
                </div>
                <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">Barcode Scanner</h2>
                <p className="mt-2 text-sm text-slate-500 max-w-md">
                    Scan a product's barcode to instantly add it to the bill.
                </p>
            </div>

            {error && (
                <div className="mb-6 flex w-full max-w-2xl items-center gap-3 rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-700">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            <div className="w-full max-w-2xl flex flex-col items-center">
                {!scanning ? (
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
                        <button 
                            onClick={() => setScanning(true)}
                            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:opacity-90 w-full sm:w-auto"
                        >
                            <ScanLine className="h-6 w-6" /> Start Camera
                        </button>
                        
                        <label className="flex items-center justify-center gap-2 rounded-xl bg-white border-2 border-indigo-100 px-8 py-4 text-lg font-bold text-indigo-600 shadow-lg shadow-indigo-100/25 transition hover:bg-indigo-50 cursor-pointer w-full sm:w-auto">
                            <ImageIcon className="h-6 w-6" /> Upload Image
                            <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={handleImageUpload} 
                            />
                        </label>
                    </div>
                ) : (
                    <div className="w-full max-w-md space-y-4">
                        <div id="reader" className="w-full overflow-hidden rounded-2xl border-4 border-slate-100 shadow-lg bg-black"></div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button 
                                onClick={() => setScanning(false)}
                                className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800"
                            >
                                Stop Camera
                            </button>
                            <button 
                                onClick={handleCaptureFrame}
                                className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-700 flex justify-center items-center gap-2"
                            >
                                <CropIcon className="h-4 w-4" /> Capture & Crop
                            </button>
                        </div>
                        <div className="flex justify-center">
                            <label className="w-full rounded-xl bg-white border-2 border-slate-200 py-3.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 cursor-pointer flex justify-center items-center gap-2">
                                <Upload className="h-4 w-4" /> Upload Instead
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={handleImageUpload} 
                                />
                            </label>
                        </div>
                    </div>
                )}
                <div id="file-reader" style={{ position: "fixed", top: "-9999px", opacity: 0 }}></div>
            </div>
        </div>

        {items.length > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-3xl border border-emerald-100 bg-white p-8 shadow-xl shadow-emerald-100/50">
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-display text-2xl font-bold text-slate-900">Current Bill</h3>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">Edit quantities or prices if needed.</p>
                    </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 mb-6">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Product</th>
                                <th className="px-6 py-4 w-32 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Qty</th>
                                <th className="px-6 py-4 w-40 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Unit Price (₹)</th>
                                <th className="px-6 py-4 w-32 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Total (₹)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((item: any, i: number) => (
                                <tr key={i} className="hover:bg-slate-50/50 transition">
                                    <td className="px-6 py-4 text-sm font-semibold text-slate-800">{item.product}</td>
                                    <td className="px-6 py-4">
                                        <input 
                                            type="number" min="1" value={item.quantity || ''}
                                            onChange={(e) => handleItemChange(i, 'quantity', parseInt(e.target.value) || 0)}
                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <input 
                                            type="number" min="0" value={item.unit_price || ''}
                                            onChange={(e) => handleItemChange(i, 'unit_price', parseInt(e.target.value) || 0)}
                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-bold text-slate-900">
                                        ₹{(item.quantity * item.unit_price) || 0}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-900 text-white">
                            <tr>
                                <td colSpan={3} className="px-6 py-4 text-right text-sm font-bold uppercase tracking-wider">Grand Total</td>
                                <td className="px-6 py-4 text-right text-lg font-black text-emerald-400">₹{calculateGrandTotal()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="mb-6 rounded-2xl bg-slate-50 p-5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Customer Name (Optional)</label>
                    <input 
                        type="text" 
                        placeholder="Leave blank for Walk-in Customer" 
                        value={billCustomerName} 
                        onChange={(e) => setBillCustomerName(e.target.value)} 
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100/70" 
                    />
                </div>

                <div className="flex justify-end gap-3">
                    <button onClick={handleClear} className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-6 py-3.5 text-sm font-bold text-rose-600 shadow-sm transition hover:bg-rose-100"><Trash2 className="h-4 w-4" /> Clear</button>
                    <button onClick={() => setShowPreview(true)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">Preview</button>
                    <button onClick={sendToWhatsApp} className="flex items-center gap-2 rounded-xl bg-[#25D366] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#25D366]/30 transition hover:bg-[#20bd5a]"><Send className="h-4 w-4" /> Send to WhatsApp</button>
                    <button onClick={handleCompleteSale} className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-700"><CheckCircle2 className="h-4 w-4" /> Complete Sale</button>
                </div>
            </div>
        )}

        {showNewProductModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="relative w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
                    <button onClick={() => { setShowNewProductModal(false); if (autoResumeCamera) setScanning(true); }} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100">✕</button>
                    <h2 className="text-xl font-black text-slate-900 mb-2">New Product</h2>
                    <p className="text-sm text-slate-500 mb-6">Barcode {newBarcode} is unknown.</p>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Product Name</label>
                            <input type="text" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:bg-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Price (₹)</label>
                            <input type="number" value={newProductPrice} onChange={(e) => setNewProductPrice(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:bg-white" />
                        </div>
                        <button onClick={handleSaveNewProduct} className="mt-4 w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-700">Save & Add to Bill</button>
                    </div>
                </div>
            </div>
        )}

        {/* Similar Preview and WhatsApp Modals as ImageBilling (omitted for brevity but normally here) */}
        {showPreview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl">
                    <button onClick={() => setShowPreview(false)} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100">✕</button>
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
                        <span>Grand Total</span><span className="text-emerald-600">₹{calculateGrandTotal()}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center space-y-3 rounded-2xl bg-slate-50 p-6">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Scan to Pay</p>
                        <div className="rounded-xl bg-white p-3 shadow-sm border border-slate-100"><QRCode value={`upi://pay?pa=quantumvoice@upi&pn=QuantumVoice&am=${calculateGrandTotal()}&cu=INR`} size={120} level="M" /></div>
                    </div>
                    <button onClick={() => setShowPreview(false)} className="mt-6 w-full rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800">Close Preview</button>
                </div>
            </div>
        )}
        
        {showWhatsAppModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="relative w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                    <button onClick={() => setShowWhatsAppModal(false)} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
                    <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2"><Send className="h-5 w-5 text-[#25D366]" /> Send via WhatsApp</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Existing Customer</label>
                            <select className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:bg-white"
                                onChange={(e) => {
                                    const c = customers.find(cust => cust.id.toString() === e.target.value);
                                    setSelectedCustomer(c || null);
                                    if (c) { setNewCustomerPhone(""); setNewCustomerName(""); }
                                }} value={selectedCustomer?.id || ""}>
                                <option value="">-- Choose Customer --</option>
                                {customers.map(c => (<option key={c.id} value={c.id}>{c.name} ({c.phone})</option>))}
                            </select>
                        </div>
                        <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-slate-200"></div><span className="flex-shrink-0 mx-4 text-xs font-medium text-slate-400">OR ENTER NEW</span><div className="flex-grow border-t border-slate-200"></div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">New Phone Number *</label>
                            <input type="text" placeholder="e.g. 9876543210" value={newCustomerPhone} disabled={!!selectedCustomer} onChange={(e) => setNewCustomerPhone(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:bg-white disabled:opacity-50" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Customer Name (Optional)</label>
                            <input type="text" placeholder="Name to save" value={newCustomerName} disabled={!!selectedCustomer} onChange={(e) => setNewCustomerName(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:bg-white disabled:opacity-50" />
                        </div>
                    </div>
                    <button onClick={handleSendWhatsAppMessage} className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#25D366]/30 transition hover:bg-[#20bd5a] active:scale-[0.98]">Send Invoice</button>
                </div>
            </div>
        )}

        {imgSrc && (
            <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col items-center animate-in zoom-in-95 duration-200">
                    <div className="w-full flex justify-between items-center mb-6">
                        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                            <CropIcon className="h-5 w-5 text-indigo-500" /> Select Barcode Region
                        </h2>
                        <button onClick={() => { setImgSrc(""); if (autoResumeCamera) setScanning(true); }} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">✕</button>
                    </div>
                    
                    <p className="text-sm font-medium text-slate-500 mb-6 text-center w-full bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                        Drag to draw a box around the barcode to help the scanner recognize it.
                    </p>
                    
                    <div className="max-h-[50vh] w-full overflow-auto rounded-2xl border-4 border-slate-100 bg-slate-50 flex justify-center items-center">
                        <ReactCrop 
                            crop={crop} 
                            onChange={(_, percentCrop) => setCrop(percentCrop)} 
                            onComplete={(c) => setCompletedCrop(c)}
                            className="max-h-[50vh]"
                        >
                            <img ref={imgRef} src={imgSrc} alt="Upload" className="max-h-[50vh] object-contain" />
                        </ReactCrop>
                    </div>
                    
                    <div className="mt-8 flex w-full gap-4">
                        <button onClick={() => { setImgSrc(""); if(autoResumeCamera) setScanning(true); }} className="flex-1 rounded-xl bg-slate-100 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-200 transition">Cancel</button>
                        <button onClick={handleCropComplete} className="flex-1 rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition">
                            Scan Selection
                        </button>
                    </div>
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
