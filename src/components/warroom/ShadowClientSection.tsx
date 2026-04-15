import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Phone, Building2, Edit2, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ShadowCompany {
  id: string;
  business_name: string;
  gst_number: string | null;
  phone: string | null;
  fssai_number: string | null;
  registered_address: string | null;
  created_at: string | null;
}

interface Props {
  companies: ShadowCompany[];
  onRefresh: () => void;
}

export default function ShadowClientSection({ companies, onRefresh }: Props) {
  const [editingCompany, setEditingCompany] = useState<ShadowCompany | null>(null);
  const [form, setForm] = useState({ business_name: "", gst_number: "", fssai_number: "", registered_address: "" });
  const [saving, setSaving] = useState(false);

  const openEdit = (c: ShadowCompany) => {
    setEditingCompany(c);
    setForm({
      business_name: c.business_name.replace(" (WhatsApp)", ""),
      gst_number: c.gst_number?.startsWith("WA:") ? "" : c.gst_number || "",
      fssai_number: c.fssai_number || "",
      registered_address: c.registered_address || "",
    });
  };

  const extractPhone = (c: ShadowCompany): string => {
    if (c.phone) return c.phone;
    if (c.gst_number?.startsWith("WA:")) return c.gst_number.replace("WA:", "+");
    return "—";
  };

  const handleConfirm = async () => {
    if (!editingCompany) return;
    setSaving(true);
    const { error } = await supabase
      .from("companies")
      .update({
        business_name: form.business_name,
        gst_number: form.gst_number || null,
        fssai_number: form.fssai_number || null,
        registered_address: form.registered_address || null,
        status: "active",
      } as any)
      .eq("id", editingCompany.id);

    setSaving(false);
    if (error) {
      toast.error("Update failed: " + error.message);
    } else {
      toast.success(`${form.business_name} confirmed & activated!`);
      setEditingCompany(null);
      onRefresh();
    }
  };

  if (companies.length === 0) return null;

  return (
    <>
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare size={16} className="text-amber-500" />
          <h2 className="text-sm font-bold text-foreground">WhatsApp Lead Verification</h2>
          <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
            {companies.length} PENDING
          </span>
        </div>
        <div className="space-y-2">
          {companies.map((c) => (
            <div key={c.id} className="flex items-center justify-between bg-background rounded-lg border border-border px-3 py-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Building2 size={14} className="text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{c.business_name}</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Phone size={10} />
                    <span>{extractPhone(c)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => openEdit(c)}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-md border border-primary/20 hover:bg-primary/5"
              >
                <Edit2 size={12} /> Edit & Verify
              </button>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!editingCompany} onOpenChange={(o) => !o && setEditingCompany(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle size={18} className="text-primary" /> Verify & Activate Client
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Business Name *</label>
              <Input value={form.business_name} onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">GST Number</label>
              <Input value={form.gst_number} onChange={(e) => setForm((f) => ({ ...f, gst_number: e.target.value }))} placeholder="e.g. 27AAPCS1234A1Z5" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">FSSAI Number (Optional)</label>
              <Input value={form.fssai_number} onChange={(e) => setForm((f) => ({ ...f, fssai_number: e.target.value }))} placeholder="e.g. 10012345000001" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Registered Address</label>
              <Input value={form.registered_address} onChange={(e) => setForm((f) => ({ ...f, registered_address: e.target.value }))} placeholder="Full address" />
            </div>
            <button
              onClick={handleConfirm}
              disabled={saving || !form.business_name.trim()}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "✅ Confirm & Activate"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
