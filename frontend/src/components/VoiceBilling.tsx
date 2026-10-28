import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Mic2, Square, Loader2, Sparkles, CheckCircle2, AlertCircle, Trash2, Send, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import QRCode from "react-qr-code";
import { useAuth } from "../App";
import PaymentModal from "./PaymentModal";
import { API_BASE_URL } from "../apiConfig";

// De-duplicates immediate consecutive duplicate words & phrases (prevents mobile speech repetition bug)
function deduplicateSpokenWords(text: string): string {
  if (!text) return "";
  let s = text.trim();
  let prev = "";
  // Run loop until stable to eliminate nested/chained repeats
  for (let iter = 0; iter < 6; iter++) {
    prev = s;
    // 6-word phrase duplicates
    s = s.replace(/\b(\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+)(?:\s+\1\b)+/gi, "$1");
    // 5-word phrase duplicates
    s = s.replace(/\b(\w+\s+\w+\s+\w+\s+\w+\s+\w+)(?:\s+\1\b)+/gi, "$1");
    // 4-word phrase duplicates
    s = s.replace(/\b(\w+\s+\w+\s+\w+\s+\w+)(?:\s+\1\b)+/gi, "$1");
    // 3-word phrase duplicates: e.g. "kandi pappu 150 kandi pappu 150"
    s = s.replace(/\b(\w+\s+\w+\s+\w+)(?:\s+\1\b)+/gi, "$1");
    // 2-word phrase duplicates: e.g. "3 kg 3 kg", "50 rupees 50 rupees", "150 rs 150 rs"
    s = s.replace(/\b(\w+\s+\w+)(?:\s+\1\b)+/gi, "$1");
    // Numeric & price repeats: e.g. "150 150", "50 50 rupees", "rs rs"
    s = s.replace(/\b(\d+\s*(?:rs|rupees|inr|kg|kgs|liters?|litres?|l|packets?|packs?|pieces?|pcs?)?)(?:\s+\1\b)+/gi, "$1");
    // 1-word duplicates: e.g. "3 3 3 3" -> "3", "5 5" -> "5", "milk milk" -> "milk"
    s = s.replace(/\b(\w+)(?:\s+\1\b)+/gi, "$1");
    if (s === prev) break;
  }
  return s.replace(/\s+/g, " ").trim();
}

// Normalizes common Indian speech mishearings
function cleanSpeechTranscript(raw: string): string {
  if (!raw) return "";
  let s = raw;
  // Replace "latest", "letters", "litters" with "liters"
  s = s.replace(/\b(latest|letter|letters|litter|litters|latter)\b/gi, "liters");
  // Spoken South Indian grocery words: e.g. "skandapoo" -> "Kandi Pappu"
  s = s.replace(/\b(skandapoo|skanda\s*poo|kanth\s*pappu|kandi\s*pappu|kandipappu)\b/gi, "Kandi Pappu");
  // Replace "to/too liters/kg" with "2 liters/kg"
  s = s.replace(/\b(?:to|too)\s+(liters?|litres?|kgs?|kilos?|packets?|packs?|pieces?|pcs?|bottles?|tins?|[a-z]+)\b/gi, "2 $1");
  // Replace "for/fore liters" with "4 liters"
  s = s.replace(/\b(?:for|fore)\s+(liters?|litres?|kgs?|kilos?|packets?|packs?|pieces?|pcs?|bottles?|tins?)\b/gi, "4 $1");
  return s;
}

export default function VoiceBilling() {
  const { shopkeeper } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [processing, setProcessing] = useState(false);
  const [billingData, setBillingData] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState("");
  const recognitionRef = useRef<any>(null);
  const baseTranscriptRef = useRef("");
  const isManuallyStoppedRef = useRef(false);

  // Billing & WhatsApp State
  const [showPreview, setShowPreview] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [billCustomerName, setBillCustomerName] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

  useEffect(() => {
    // Check if browser supports SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const recognition = new SpeechRecognition();
      // On mobile (especially Android Chrome), continuous + interimResults produces duplicate results & repeated words
      // Disabling continuous and interimResults on mobile eliminates the duplicate hypotheses bug completely.
      recognition.continuous = !isMobile;
      recognition.interimResults = !isMobile;
      // Use en-IN for Indian accent recognition
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setIsRecording(true);
        setError("");
      };

      recognition.onresult = (event: any) => {
        let currentFinal = "";
        let currentInterim = "";

        if (isMobile) {
          // On mobile Android Chrome, find the latest authoritative transcript to avoid stacking interim guesses
          for (let i = event.results.length - 1; i >= 0; i--) {
            const piece = event.results[i][0]?.transcript || "";
            if (piece.trim()) {
              currentFinal = piece.trim();
              break;
            }
          }
        } else {
          // On desktop, assemble from event.results sequentially
          for (let i = 0; i < event.results.length; i++) {
            const piece = event.results[i][0]?.transcript || "";
            if (event.results[i].isFinal) {
              currentFinal += piece + " ";
            } else {
              currentInterim += piece;
            }
          }
        }

        const base = baseTranscriptRef.current.trim();
        const sessionText = (currentFinal + " " + currentInterim).trim();
        const fullCombined = base ? `${base} ${sessionText}` : sessionText;
        const cleaned = cleanSpeechTranscript(deduplicateSpokenWords(fullCombined));
        setTranscript(cleaned);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed') {
            setError("Microphone access was denied. Please allow microphone access to use voice billing.");
        } else if (event.error !== 'no-speech') {
            setError(`Speech recognition error: ${event.error}`);
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        // Natural end of speech: cleanly stop recording.
        // DO NOT auto-restart in a loop, which caused the mobile multiple-input bug!
        setIsRecording(false);
        setTranscript(prev => {
          const finalCleaned = cleanSpeechTranscript(deduplicateSpokenWords(prev));
          baseTranscriptRef.current = finalCleaned;
          return finalCleaned;
        });
      };

      recognitionRef.current = recognition;
    } else {
      setError("Your browser does not support Speech Recognition. Please use Chrome or Edge.");
    }

    return () => {
        if (recognitionRef.current) {
            recognitionRef.current.abort();
        }
    };
  }, []);

  const startRecording = () => {
    // If starting fresh with items already processed, clear previous bill
    if (items.length > 0) {
      setBillingData(null);
      setItems([]);
      setTranscript("");
      baseTranscriptRef.current = "";
    } else {
      // If adding more speech to an existing prompt, keep existing text as base
      baseTranscriptRef.current = transcript.trim();
    }

    setError("");
    isManuallyStoppedRef.current = false;
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const stopRecording = () => {
    isManuallyStoppedRef.current = true;
    setIsRecording(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setTranscript(prev => {
      const finalCleaned = cleanSpeechTranscript(deduplicateSpokenWords(prev));
      baseTranscriptRef.current = finalCleaned;
      return finalCleaned;
    });
  };

  const processBill = async () => {
    if (!transcript) {
        toast.error("No speech detected.");
        return;
    }
    setProcessing(true);
    setError("");
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/voice-billing/`, {
        text: transcript,
        shopkeeper_email: shopkeeper?.email
      });
      
      if (response.data && response.data.success) {
          setBillingData(response.data);
          setItems(response.data.items.map((i: any) => ({
              ...i,
              quantity: i.quantity || 1,
              unit_price: i.unit_price || 0
          })));
          toast.success("Bill processed successfully!");
      } else {
          setError(response.data.error || "Failed to process the bill.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Could not identify the product and price. Please speak again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleClear = () => {
      setTranscript("");
      baseTranscriptRef.current = "";
      setBillingData(null);
      setItems([]);
      setBillCustomerName("");
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
          toast.error("Please add prices to the products before sending.");
          return;
      }
      
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
                  qgbi: billingData?.qgbi || "QGBI-VERIFIED",
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
        <div className="flex flex-col items-center rounded-2xl sm:rounded-3xl border border-violet-100 bg-white p-5 sm:p-10 shadow-xl shadow-violet-100/40">
            
            <div className="mb-6 flex flex-col items-center text-center">
                <div className="mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30">
                    <Sparkles className="h-7 w-7 sm:h-8 sm:w-8" />
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">SmartQ-Bill</h2>
                <p className="mt-2 text-xs sm:text-sm text-slate-500 max-w-md">
                    AI-Driven Voice Billing with Quantum. Speak your bill, and we'll handle the rest.
                </p>
            </div>

            <div className="relative mb-6 sm:mb-8 flex flex-col items-center">
                {isRecording ? (
                    <button 
                        onClick={stopRecording}
                        className="group relative flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-rose-500 text-white shadow-xl shadow-rose-500/40 transition hover:bg-rose-600 hover:scale-105 active:scale-95"
                    >
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                        <Square className="h-7 w-7 sm:h-8 sm:w-8 fill-current" />
                    </button>
                ) : (
                    <button 
                        onClick={startRecording}
                        disabled={processing}
                        className="group flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-xl shadow-indigo-500/40 transition hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                    >
                        {processing ? <Loader2 className="h-7 w-7 sm:h-8 sm:w-8 animate-spin" /> : <Mic2 className="h-8 w-8 sm:h-10 sm:w-10 transition group-hover:scale-110" />}
                    </button>
                )}
                
                <p className="mt-3 sm:mt-4 text-xs sm:text-sm font-semibold text-slate-600">
                    {isRecording ? (
                        <span className="flex items-center gap-2 text-rose-500 animate-pulse">
                            <span className="h-2 w-2 rounded-full bg-rose-500"></span> Listening...
                        </span>
                    ) : processing ? (
                        <span className="text-violet-600 flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Extracting products &amp; costs...
                        </span>
                    ) : (
                        "Tap to speak"
                    )}
                </p>
            </div>

            {error && (
                <div className="mb-6 flex w-full max-w-2xl items-center gap-3 rounded-xl bg-rose-50 p-3.5 sm:p-4 text-xs sm:text-sm font-medium text-rose-700">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            <div className="w-full max-w-2xl">
                <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <p className="mb-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Original Voice Text (Editable)</p>
                    <div className="min-h-[80px] rounded-xl bg-white shadow-inner focus-within:ring-2 focus-within:ring-violet-200">
                        <textarea
                            value={transcript}
                            onChange={(e) => setTranscript(e.target.value)}
                            disabled={isRecording || processing}
                            placeholder="Speak to see your text here, or type it manually... e.g. two liters milk for 120"
                            className="w-full min-h-[90px] sm:min-h-[100px] resize-y rounded-xl bg-transparent p-3 sm:p-4 text-base sm:text-lg font-medium text-slate-800 leading-relaxed outline-none disabled:bg-slate-50 disabled:text-slate-500 placeholder:text-slate-300 placeholder:italic"
                        />
                    </div>
                </div>

                {!isRecording && transcript && !processing && items.length === 0 && (
                    <button 
                        onClick={processBill}
                        className="mt-4 w-full rounded-xl bg-slate-900 py-3.5 text-xs sm:text-sm font-bold text-white shadow-lg transition hover:bg-violet-600 active:scale-[0.98]"
                    >
                        Process Bill with AI
                    </button>
                )}
            </div>
        </div>

        {items.length > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-2xl sm:rounded-3xl border border-emerald-100 bg-white p-4 sm:p-8 shadow-xl shadow-emerald-100/50">
                <div className="mb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-900">Generated Bill</h3>
                            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5" /> AI Processed Result
                            </span>
                        </div>
                        <p className="mt-1 text-xs sm:text-sm text-slate-500">Products and costs successfully extracted. You can edit quantities and prices.</p>
                    </div>
                    {billingData?.qgbi && (
                        <div className="self-start sm:self-auto sm:text-right">
                            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-violet-500">Quantum Bill ID (QGBI)</p>
                            <p className="mt-1 font-mono text-xs sm:text-sm font-semibold text-slate-700 bg-violet-50 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-violet-100 inline-block">{billingData.qgbi}</p>
                        </div>
                    )}
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
                                            type="number" min="1" value={item.quantity || ''}
                                            onChange={(e) => handleItemChange(i, 'quantity', parseInt(e.target.value) || 0)}
                                            className="w-14 sm:w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center sm:text-right text-xs sm:text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                        />
                                    </td>
                                    <td className="px-2 py-3 sm:px-6 sm:py-4 text-center sm:text-right">
                                        <input 
                                            type="number" min="0" value={item.unit_price || ''}
                                            onChange={(e) => handleItemChange(i, 'unit_price', parseInt(e.target.value) || 0)}
                                            className="w-16 sm:w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center sm:text-right text-xs sm:text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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
                    <button onClick={() => setShowPreview(false)} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
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
                            <QRCode value={`UPI ID: quantumvoice@upi | Total: ₹${calculateGrandTotal()}`} size={120} level="M" />
                        </div>
                    </div>
                    <button onClick={() => setShowPreview(false)} className="mt-6 w-full rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 active:scale-[0.98]">Close Preview</button>
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

        {/* Payment Method Modal (Matches Phone 2 & 3 in user screenshot) */}
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
