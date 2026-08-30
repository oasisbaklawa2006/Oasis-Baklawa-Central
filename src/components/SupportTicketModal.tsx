import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { customerAppClient } from "@/lib/customerApp/customerAppClient";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  orderId: string;
}

const issueTypes = ["Damaged Goods", "Missing Items", "Wrong Shipment"];

const SupportTicketModal = ({ open, onClose, orderId }: Props) => {
  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!issueType || !description.trim() || submitting) return;
    setSubmitting(true);
    try {
      await customerAppClient.submitTicket(orderId, issueType, description.trim());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit ticket");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setIssueType("");
      setDescription("");
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

            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" />
              <h2 className="font-display text-lg tracking-wide text-foreground">Raise Ticket</h2>
            </div>
            <p className="font-fine text-[11px] text-muted-foreground">Order: {orderId}</p>

            {!submitted ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="font-body text-xs font-semibold text-foreground">Issue Type</label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select an issue…</option>
                    {issueTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue"
                  rows={3}
                  className="w-full rounded-xl bg-muted/50 border border-border px-4 py-3 font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />

                <button
                  onClick={handleSubmit}
                  disabled={!issueType || !description.trim() || submitting}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-body font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-fab disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting…" : "Submit Ticket"}
                </button>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6 space-y-2"
              >
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                  <AlertTriangle size={20} className="text-green-600" />
                </div>
                <p className="font-body font-bold text-foreground text-sm">Ticket Submitted</p>
                <p className="font-body text-xs text-muted-foreground">Our team will respond within 24 hours.</p>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SupportTicketModal;
