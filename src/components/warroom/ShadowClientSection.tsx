import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Phone, Building2, Edit2, CheckCircle, Package } from "lucide-react";
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

interface DraftOrderInfo {
  order_id: string;
  items: { product_name: string; quantity: number }[];
}

interface Props {
  companies: ShadowCompany[];
  onRefresh: () => void;
}

export default function ShadowClientSection({ companies, onRefresh }: Props) {
  const [editingCompany, setEditingCompany] = useState<ShadowCompany | null>(null);
  const [form, setForm] = useState({ business_name: "", gst_number: "", fssai_number: "", registered_address: "" });
  const [saving, setSaving] = useState(false);
  const [draftOrders, setDraftOrders] = useState<Record<string, DraftOrderInfo[]>>({});

  // Fetch draft orders for all shadow companies
  useEffect(() => {
    if (companies.length === 0) return;
    const companyIds = companies.map((c) => c.id);

    (async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("id, company_id")
        .in("company_id", companyIds)
        .in("status", ["draft", "submitted", "cart"]);

      if (!orders || orders.length === 0) { setDraftOrders({}); return; }

      const orderIds = orders.map((o) => o.id);
      const { data: items } = await supabase
        .from("order_items")
        .select("order_id, quantity, product_id, products(name)")
        .in("order_id", orderIds);

      const map: Record<string, DraftOrderInfo[]> = {};
      orders.forEach((o) => {
        if (!map[o.company_id!]) map[o.company_id!] = [];
        const orderItems = (items ?? [])
          .filter((i: any) => i.order_id === o.id)
          .map((i: any) => ({ product_name: i.products?.name || "Unknown SKU", quantity: i.quantity }));
        map[o.company_id!].push({ order_id: o.id, items: orderItems });
      });
      setDraftOrders(map);
    })();
  }, [companies]);

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

  const editingDrafts = editingCompany ? draftOrders[editingCompany.id] || [] : [];

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
          {companies.map((c) => {
            const drafts = draftOrders[c.id] || [];
            return (
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
                      {drafts.length > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          <Package size={9} /> {drafts.length} Order{drafts.length > 1 ? "s" : ""} Pending
                        </span>
                      )}
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
            );
          })}
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
            {/* Pending WhatsApp Items Preview */}
            {editingDrafts.length > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs font-bold text-primary mb-2 flex items-center gap-1.5">
                  <Package size={12} /> Pending WhatsApp Orders ({editingDrafts.length})
                </p>
                {editingDrafts.map((draft) => (
                  <div key={draft.order_id} className="mb-2 last:mb-0">
                    <p className="text-[10px] font-mono text-muted-foreground mb-1">#{draft.order_id.slice(0, 8).toUpperCase()}</p>
                    <div className="flex flex-wrap gap-1">
                      {draft.items.length === 0 && (
                        <span className="text-[10px] text-muted-foreground italic">No items decoded yet</span>
                      )}
                      {draft.items.map((item, i) => (
                        <span key={i} className="text-[10px] bg-background px-2 py-0.5 rounded-full border border-border text-foreground">
                          {item.product_name} × {item.quantity}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

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
