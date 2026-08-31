import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  grandTotal: number;
  orderId?: string | null;
  companyId?: string | null;
  onOrderConfirmed?: () => void;
}

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN");

/**
 * Presents a review hand-off only; Core calculates and commits the canonical
 * order and advance when the buyer submits the governed cart.
 */
const CheckoutModal = ({ open, onClose, grandTotal }: CheckoutModalProps) => {
  const navigate = useNavigate();

  /** Moves legacy callers into the canonical Buyer cart without writing orders. */
  const handleConfirm = async () => {
    onClose();
    navigate("/buyer/cart");
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
                  <p className="font-body font-bold text-foreground text-sm">Advance calculated by Core</p>
                </div>
                <p className="font-display text-2xl text-primary tracking-wide">Resolved at governed submission</p>
                <p className="font-body text-[11px] text-muted-foreground leading-relaxed">
                  Production begins upon advance confirmation. Balance due before dispatch.
                </p>
              </div>

              {/* CTA - fixed on mobile */}
              <div className="sm:static fixed bottom-0 left-0 right-0 sm:p-0 p-4 bg-background sm:bg-transparent border-t sm:border-0 border-border/50 space-y-2">
                <button
                  onClick={handleConfirm}
                  className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-body font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-fab disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Review in Buyer cart
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
