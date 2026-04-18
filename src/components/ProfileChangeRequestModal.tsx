import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  companyId: string;
  field: "business_name" | "gst_number" | "registered_address";
  currentValue: string;
}

const FIELD_LABEL: Record<Props["field"], string> = {
  business_name: "Company Name",
  gst_number: "GST Number",
  registered_address: "Registered Address",
};

const ProfileChangeRequestModal = ({ open, onClose, companyId, field, currentValue }: Props) => {
  const [value, setValue] = useState(currentValue);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<{ id: string; requested_value: string; created_at: string } | null>(null);

  useEffect(() => {
    setValue(currentValue);
  }, [currentValue, open]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("profile_change_requests" as any)
        .select("id, requested_value, created_at")
        .eq("company_id", companyId)
        .eq("field_name", field)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setPending((data as any) ?? null);
    })();
  }, [open, companyId, field]);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === currentValue) {
      toast.error("Please enter a new value.");
      return;
    }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("profile_change_requests" as any).insert({
      company_id: companyId,
      requested_by: user?.id,
      field_name: field,
      current_value: currentValue,
      requested_value: trimmed,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Change request submitted. An admin will review it shortly.");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-card rounded-2xl border border-border p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-foreground">
                Request Change · {FIELD_LABEL[field]}
              </h2>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
                <X size={16} />
              </button>
            </div>

            {pending && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                A previous request to change this field to <strong>"{pending.requested_value}"</strong> is awaiting admin approval. Submitting a new request will queue alongside it.
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Current
              </label>
              <p className="text-sm text-foreground bg-muted/40 rounded-lg px-3 py-2">{currentValue || "—"}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Requested New Value
              </label>
              {field === "registered_address" ? (
                <textarea
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  rows={3}
                  className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-primary"
                />
              ) : (
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-primary"
                />
              )}
            </div>

            <p className="text-[11px] text-muted-foreground">
              Edits to legally sensitive fields require admin approval. You'll be notified once reviewed.
            </p>

            <button
              disabled={submitting}
              onClick={submit}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Submit for Approval
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProfileChangeRequestModal;
