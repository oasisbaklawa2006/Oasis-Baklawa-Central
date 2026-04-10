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
  dispatchDate?: string | null;
}

const issueTypes = [
  "Missing Items",
  "Damaged Goods",
  "Quality Issue",
  "Wrong Shipment",
  "Packaging Defect",
  "Billing / GST Error",
];

const routeDepartment = (issueType: string): string => {
  const t = (issueType || "").toLowerCase();
  if (t.includes("quality")) return "Production";
  if (t.includes("packaging") || t.includes("damaged")) return "Assembly";
  if (t.includes("missing") || t.includes("wrong")) return "Dispatch";
  if (t.includes("billing") || t.includes("gst")) return "Finance";
  return "Operations";
};

const ClaimModal = ({ open, onClose, orderId, dispatchDate }: Props) => {
  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");
  const [productSku, setProductSku] = useState("");
  const [qtyAffected, setQtyAffected] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // 10-day window check
  const isOutOfWindow = (() => {
    if (!dispatchDate) return false;
    const diff = (Date.now() - new Date(dispatchDate).getTime()) / 86400000;
    return diff > 10;
  })();

  const handleSubmit = async () => {
    if (!issueType || !user || !productSku.trim() || !qtyAffected) {
      toast.error("All mandatory fields are required");
      return;
    }
    setLoading(true);

    const now = new Date();
    const windowStatus = isOutOfWindow ? "OUT_OF_WINDOW" : "WITHIN_WINDOW";
    const routed = routeDepartment(issueType);

    const { error } = await supabase.from("support_tickets").insert({
      order_id: orderId,
      issue_type: issueType,
      description: description || "No description provided",
      user_id: user.id,
      product_sku: productSku.trim(),
      qty_affected: parseInt(qtyAffected) || 1,
      dispatch_date: dispatchDate || null,
      window_status: windowStatus,
      routed_to_department: routed,
      severity: "Medium",
      sla_first_response_due: new Date(now.getTime() + 2 * 3600000).toISOString(),
      sla_action_due: new Date(now.getTime() + 24 * 3600000).toISOString(),
      sla_resolution_due: new Date(now.getTime() + 72 * 3600000).toISOString(),
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
      setProductSku("");
      setQtyAffected("");
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

            <div className="px-5 py-5 space-y-4">
              {submitted ? (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-8 space-y-3">
                  <CheckCircle2 size={48} className="mx-auto text-primary" />
                  <p className="text-sm font-semibold text-foreground">Claim Submitted</p>
                  <p className="text-xs text-muted-foreground">SLA Timers Active. Routed to {routeDepartment(issueType)}.</p>
                </motion.div>
              ) : (
                <>
                  {isOutOfWindow && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2 text-xs text-destructive font-medium">
                      ⚠ This order was dispatched over 10 days ago. Resolution options are limited unless Admin overrides.
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">Order: {orderId}</p>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Issue Type *</label>
                    <select
                      value={issueType}
                      onChange={(e) => setIssueType(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Select issue type…</option>
                      {issueTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Product SKU *</label>
                      <input
                        value={productSku}
                        onChange={(e) => setProductSku(e.target.value)}
                        placeholder="e.g. OB-BAK-001"
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Qty Affected *</label>
                      <input
                        type="number"
                        min="1"
                        value={qtyAffected}
                        onChange={(e) => setQtyAffected(e.target.value)}
                        placeholder="1"
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the issue…"
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Attach Proof (optional)</label>
                    <button className="w-full py-3 rounded-xl border-2 border-dashed border-border text-xs text-muted-foreground flex items-center justify-center gap-2 hover:border-primary/50 transition-colors">
                      <Upload size={16} /> Upload Photos
                    </button>
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={!issueType || !productSku.trim() || !qtyAffected || loading}
                    className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    {loading ? "Submitting…" : isOutOfWindow ? "Submit (Out of Window)" : "Submit Claim"}
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
