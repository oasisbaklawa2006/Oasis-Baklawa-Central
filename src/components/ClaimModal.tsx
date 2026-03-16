import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  orderId: string;
}

const issueTypes = ["Missing Items", "Damaged Goods", "Quality Issue"];

const ClaimModal = ({ open, onClose, orderId }: Props) => {
  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async () => {
    if (!issueType || !user) return;
    setLoading(true);
    const { error } = await supabase.from("support_tickets").insert({
      order_id: orderId,
      issue_type: issueType,
      description: description || "No description provided",
      user_id: user.id,
    });
    setLoading(false);
    if (error) {
      toast.error("Failed to submit claim: " + error.message);
      return;
    }
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative bg-background w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-background z-10 px-5 pt-5 pb-3 flex items-center justify-between border-b border-border/50">
              <h2 className="text-display-h2 text-foreground">Raise Issue / Claim</h2>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center">
                <X size={16} className="text-foreground" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-5">
              {submitted ? (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-8 space-y-3">
                  <CheckCircle2 size={48} className="mx-auto text-primary" />
                  <p className="text-body-p1 text-foreground font-semibold">Claim Submitted</p>
                  <p className="text-body-p3 text-muted-foreground">Order: {orderId}</p>
                </motion.div>
              ) : (
                <>
                  <p className="text-ui-label text-muted-foreground">Order: {orderId}</p>

                  <div className="space-y-2">
                    <label className="text-ui-label text-foreground">Issue Type</label>
                    <select
                      value={issueType}
                      onChange={(e) => setIssueType(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-body-p2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Select issue type…</option>
                      {issueTypes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-ui-label text-foreground">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the issue in detail…"
                      rows={4}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-body-p2 text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-ui-label text-foreground">Attach Photos (optional)</label>
                    <button className="w-full py-3 rounded-xl border-2 border-dashed border-border text-ui-button text-muted-foreground flex items-center justify-center gap-2 hover:border-primary/50 transition-colors">
                      <Upload size={16} />
                      Upload Images
                    </button>
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={!issueType || loading}
                    className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-ui-button hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    {loading ? "Submitting…" : "Submit Claim"}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ClaimModal;
