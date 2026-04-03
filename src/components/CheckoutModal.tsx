import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, Smartphone, Building, CheckCircle2, ShieldCheck, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  grandTotal: number;
  orderId?: string | null;
  companyId?: string | null;
  onOrderConfirmed?: () => void;
}

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN");

const paymentMethods = [
  { id: "upi", label: "Pay via UPI", desc: "Google Pay, PhonePe, Paytm", icon: Smartphone },
  { id: "neft", label: "NEFT / Bank Transfer", desc: "Direct bank transfer", icon: Building },
  { id: "wallet", label: "Use Wallet Balance", desc: "Available: ₹45,000", icon: Wallet },
];

const CheckoutModal = ({ open, onClose, grandTotal, orderId, onOrderConfirmed }: CheckoutModalProps) => {
  const [selected, setSelected] = useState("upi");
  const [confirming, setConfirming] = useState(false);
  const advance = Math.round(grandTotal * 0.5);

  const handleConfirm = async () => {
    if (!orderId) {
      toast.error("No active order found");
      return;
    }
    setConfirming(true);
    const { error } = await supabase
      .from("orders")
      .update({
        status: "submitted",
        sales_order_value: grandTotal,
        advance_required: advance,
        payment_status: "awaiting_receipt",
      })
      .eq("id", orderId);

    setConfirming(false);
    if (error) {
      console.error("[Checkout] Order confirm failed:", error);
      toast.error(error.message || "Failed to confirm order. Please try again.");
      return;
    }
    toast.success("Order confirmed! Advance payment initiated.");
    onOrderConfirmed?.();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative bg-background w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-background z-10 px-5 pt-5 pb-3 flex items-center justify-between border-b border-border/50">
              <h2 className="font-display text-xl tracking-wide text-foreground">Sales Order Preview</h2>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center">
                <X size={16} className="text-foreground" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-5">
              {/* Order Total */}
              <div className="bg-card rounded-2xl shadow-card p-5 text-center space-y-1">
                <p className="font-body text-xs text-muted-foreground font-medium">Grand Total</p>
                <p className="font-display text-3xl text-foreground tracking-wide">{formatPrice(grandTotal)}</p>
                <p className="font-body text-[11px] text-muted-foreground">Inclusive of 18% GST</p>
              </div>

              {/* Advance Required */}
              <div className="bg-primary/5 rounded-2xl border border-primary/20 p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-primary" />
                  <p className="font-body font-bold text-foreground text-sm">50% Advance Required for Production</p>
                </div>
                <p className="font-display text-2xl text-primary tracking-wide">{formatPrice(advance)}</p>
                <p className="font-body text-[11px] text-muted-foreground leading-relaxed">
                  Production begins upon advance confirmation. Balance due before dispatch.
                </p>
              </div>

              {/* Payment Methods */}
              <div className="space-y-3">
                <h3 className="font-body font-bold text-foreground text-sm">Select Payment Method</h3>
                {paymentMethods.map((pm) => {
                  const isSelected = selected === pm.id;
                  return (
                    <button
                      key={pm.id}
                      onClick={() => setSelected(pm.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-card hover:border-primary/30"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? "bg-primary/10" : "bg-muted/60"}`}>
                        <pm.icon size={18} className={isSelected ? "text-primary" : "text-muted-foreground"} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-body font-semibold text-foreground text-sm">{pm.label}</p>
                        <p className="font-body text-[11px] text-muted-foreground">{pm.desc}</p>
                      </div>
                      {isSelected && <CheckCircle2 size={18} className="text-primary" />}
                    </button>
                  );
                })}
              </div>

              {/* CTA - fixed on mobile */}
              <div className="sm:static fixed bottom-0 left-0 right-0 sm:p-0 p-4 bg-background sm:bg-transparent border-t sm:border-0 border-border/50 space-y-2">
                <button
                  onClick={handleConfirm}
                  className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-body font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-fab"
                >
                  {confirming ? <Loader2 size={16} className="animate-spin" /> : null}
                  {confirming ? "Confirming…" : "Pay Advance & Confirm Order"}
                </button>
                <p className="font-body text-[10px] text-muted-foreground text-center leading-relaxed">
                  By confirming, you agree to Oasis Baklawa's B2B terms. Advance is non-refundable once production begins.
                </p>
              </div>
              {/* Spacer for fixed CTA on mobile */}
              <div className="h-20 sm:hidden" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CheckoutModal;
