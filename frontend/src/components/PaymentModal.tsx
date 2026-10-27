import React, { useState, useEffect } from "react";
import { Sparkles, X, Banknote, QrCode, ArrowRight, CheckCircle2, Copy } from "lucide-react";
import QRCode from "react-qr-code";
import { toast } from "sonner";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  totalAmount: number;
  onConfirm: (paymentMode: "Cash" | "UPI", paymentDetails: any) => Promise<void>;
  storeName?: string;
}

export default function PaymentModal({
  isOpen,
  onClose,
  customerName,
  totalAmount,
  onConfirm,
  storeName = "QuantumVoice Store",
}: PaymentModalProps) {
  const [paymentMode, setPaymentMode] = useState<"Cash" | "UPI">("Cash");
  const [cashReceived, setCashReceived] = useState<number>(totalAmount);
  const [showQrScreen, setShowQrScreen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    setCashReceived(totalAmount);
    setShowQrScreen(false);
  }, [totalAmount, isOpen]);

  if (!isOpen) return null;

  const changeToReturn = Math.max(0, cashReceived - totalAmount);

  const handleQuickAdd = (amount: number) => {
    setCashReceived((prev) => prev + amount);
  };

  const handleSetExact = () => {
    setCashReceived(totalAmount);
  };

  const handleConfirmPayment = async () => {
    setSubmitting(true);
    try {
      if (paymentMode === "Cash") {
        await onConfirm("Cash", {
          cash_received: cashReceived,
          change_returned: changeToReturn,
        });
      } else {
        await onConfirm("UPI", {
          upi_status: "Verified",
        });
      }
      onClose();
    } catch (err) {
      console.error("Payment confirmation failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Generate dynamic UPI payment link
  const upiId = "quantumvoice@upi";
  const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
    storeName
  )}&am=${totalAmount}&cu=INR&tn=${encodeURIComponent("Invoice Payment")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* Purple Gradient Header */}
        <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-5 text-white relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-200" />
              <span className="text-xs font-bold tracking-wider uppercase">
                Select Payment Method
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="text-[11px] text-white/70 uppercase tracking-wide">
                Customer
              </div>
              <div className="text-sm font-bold text-white truncate max-w-[180px]">
                {customerName || "Walk-in Customer"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-white/70 uppercase tracking-wide">
                Total Amount
              </div>
              <div className="text-xl font-extrabold text-white">
                ₹{totalAmount}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {!showQrScreen ? (
            <>
              {/* Choose Payment Mode Heading */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase block mb-2">
                  Choose Payment Mode:
                </span>
                <div className="grid grid-cols-2 gap-3">
                  {/* Cash Option */}
                  <button
                    type="button"
                    onClick={() => setPaymentMode("Cash")}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                      paymentMode === "Cash"
                        ? "border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`p-2 rounded-xl shrink-0 ${
                          paymentMode === "Cash"
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <Banknote className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800">
                          Cash
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          Physical curre...
                        </div>
                      </div>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ml-1 ${
                        paymentMode === "Cash"
                          ? "border-emerald-500 bg-emerald-500"
                          : "border-slate-300"
                      }`}
                    >
                      {paymentMode === "Cash" && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                  </button>

                  {/* UPI / QR Option */}
                  <button
                    type="button"
                    onClick={() => setPaymentMode("UPI")}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                      paymentMode === "UPI"
                        ? "border-violet-600 bg-violet-50/30 ring-2 ring-violet-500/20"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`p-2 rounded-xl shrink-0 ${
                          paymentMode === "UPI"
                            ? "bg-violet-600 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <QrCode className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800">
                          UPI / QR
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          GPay, PhonePe...
                        </div>
                      </div>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ml-1 ${
                        paymentMode === "UPI"
                          ? "border-violet-600 bg-violet-600"
                          : "border-slate-300"
                      }`}
                    >
                      {paymentMode === "UPI" && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* Conditional Content: CASH */}
              {paymentMode === "Cash" && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Cash Received
                    </span>
                    <button
                      type="button"
                      onClick={handleSetExact}
                      className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    >
                      Exact (₹{totalAmount})
                    </button>
                  </div>

                  {/* Cash Amount Input */}
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">
                      ₹
                    </span>
                    <input
                      type="number"
                      value={cashReceived}
                      onChange={(e) =>
                        setCashReceived(Number(e.target.value) || 0)
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                      placeholder="0"
                    />
                  </div>

                  {/* Quick Cash Chips */}
                  <div className="grid grid-cols-4 gap-2">
                    {[50, 100, 200, 500].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleQuickAdd(amt)}
                        className="py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-colors"
                      >
                        +₹{amt}
                      </button>
                    ))}
                  </div>

                  {/* Change to Return */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-slate-500 font-medium">
                      Change to Return:
                    </span>
                    <span className="font-extrabold text-sm text-emerald-600">
                      ₹{changeToReturn}
                    </span>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmPayment}
                      disabled={submitting}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-1.5"
                    >
                      {submitting ? (
                        "Processing..."
                      ) : (
                        <>
                          Confirm Cash (₹{totalAmount}) <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Conditional Content: UPI / QR */}
              {paymentMode === "UPI" && (
                <div className="space-y-4 pt-1">
                  <div className="p-3.5 rounded-2xl bg-violet-50/60 border border-violet-100 space-y-2">
                    <div className="flex items-center gap-2 text-violet-700 text-xs font-bold">
                      <QrCode className="w-4 h-4" />
                      <span>Instant QR Code Payment</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Clicking confirm will open a dynamic, scannable UPI QR code
                      for <strong>₹{totalAmount}</strong> compatible with Google Pay,
                      PhonePe, Paytm, and BHIM UPI apps.
                    </p>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowQrScreen(true)}
                      className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-md shadow-violet-600/20 transition flex items-center justify-center gap-1.5"
                    >
                      Open UPI QR Code <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Scannable Dynamic QR Screen */
            <div className="text-center space-y-4 py-2 animate-in fade-in duration-200">
              <div className="inline-block p-4 bg-white rounded-2xl border-2 border-dashed border-violet-300 shadow-inner">
                <QRCode value={upiLink} size={180} level="M" />
              </div>

              <div>
                <div className="text-xs font-bold text-slate-800">
                  Scan to Pay ₹{totalAmount}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Google Pay • PhonePe • Paytm • Any UPI App
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 bg-slate-50 py-1.5 px-3 rounded-lg border border-slate-200">
                <span>UPI ID: <strong>{upiId}</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(upiId);
                    toast.success("UPI ID copied!");
                  }}
                  className="text-violet-600 hover:text-violet-700 font-bold inline-flex items-center gap-0.5"
                >
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQrScreen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-1.5"
                >
                  {submitting ? (
                    "Processing..."
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Payment Received (Confirm)
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

