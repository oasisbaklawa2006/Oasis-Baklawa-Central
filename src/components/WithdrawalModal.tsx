import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, CheckCircle2 } from "lucide-react";
import { useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const WithdrawalModal = ({ open, onClose }: Props) => {
  const [amount, setAmount] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setAmount("");
      onClose();
    }, 2000);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center px-4 pb-4"
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative bg-card rounded-3xl shadow-card w-full max-w-sm overflow-hidden p-6 space-y-5"
          >
            <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center">
              <X size={16} className="text-foreground" />
            </button>

            {!submitted ? (
              <>
                <div className="flex items-center gap-2">
                  <Wallet size={18} className="text-primary" />
                  <h2 className="font-display text-lg tracking-wide text-foreground">Request Withdrawal</h2>
                </div>

                <div className="space-y-2">
                  <label className="font-body text-xs font-semibold text-foreground">Enter Amount (₹)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 10000"
                    className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!amount || Number(amount) <= 0}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-body font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-fab disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Bank Transfer Request
                </button>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6 space-y-2"
              >
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={20} className="text-green-600" />
                </div>
                <p className="font-body font-bold text-foreground text-sm">Withdrawal Requested</p>
                <p className="font-body text-xs text-muted-foreground">₹{Number(amount).toLocaleString("en-IN")} will be transferred within 2-3 business days.</p>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WithdrawalModal;
