import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Phone, Building2, Edit2, CheckCircle, Package, Search, ArrowRight, AlertTriangle } from "lucide-react";
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

interface HistoryMessage {
  id: string;
  phone_number: string | null;
  raw_payload: any;
  created_at: string;
  processed: boolean | null;
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
  const [historyMessages, setHistoryMessages] = useState<HistoryMessage[]>([]);
  const [scanningHistory, setScanningHistory] = useState(false);
  const [historyScanned, setHistoryScanned] = useState(false);

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

  const extractPhone = (c: ShadowCompany): string => {
    if (c.phone && c.phone.trim().length > 0) return c.phone.trim();
    if (c.gst_number?.startsWith("WA:")) return c.gst_number.replace("WA:", "+");
    return "";
  };

  const extractPhoneDigits = (c: ShadowCompany): string => {
    const raw = extractPhone(c);
    return raw.replace(/\D/g, "");
  };

  const openEdit = async (c: ShadowCompany) => {
    setEditingCompany(c);
    setHistoryMessages([]);
    setHistoryScanned(false);
    setForm({
      business_name: c.business_name.replace(" (WhatsApp)", ""),
      gst_number: c.gst_number?.startsWith("WA:") ? "" : c.gst_number || "",
      fssai_number: c.fssai_number || "",
      registered_address: c.registered_address || "",
    });

    await scanHistory(c);
  };

  const scanHistory = async (c: ShadowCompany) => {
    setScanningHistory(true);
    const digits = extractPhoneDigits(c);

    if (!digits || digits.length < 10) {
      setScanningHistory(false);
      setHistoryScanned(true);
      return;
    }

    const last10 = digits.slice(-10);

    const { data } = await supabase
      .from("debug_webhooks")
      .select("id, phone_number, raw_payload, created_at, processed")
      .eq("direction", "inbound")
      .or(`phone_number.ilike.%${last10}%`)
      .eq("processed", false)
      .order("created_at", { ascending: false })
      .limit(50);

    setHistoryMessages((data as HistoryMessage[]) ?? []);
    setScanningHistory(false);
    setHistoryScanned(true);
  };

  const extractText = (payload: any): string => {
    if (!payload) return "";
    const msg = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (msg?.text?.body) return msg.text.body;
    if (typeof payload === "string") return payload.slice(0, 200);
    const str = JSON.stringify(payload);
    const textMatch = str.match(/"body"\s*:\s*"([^"]+)"/);
    if (textMatch) return textMatch[1];
    return str.slice(0, 150);
  };

  const handleConfirm = async () => {
    if (!editingCompany) return;
    setSaving(true);

    const unattached = historyMessages.filter((m) => !m.processed);
    const clientPhone = extractPhone(editingCompany);

    // Extract SKU names from message history (best-effort)
    const skuNames: string[] = [];

    // Build WhatsApp confirmation message
    const portalUrl = "https://id-preview--a2649760-8f34-4dcf-aaf4-ff101ea06ef6.lovable.app";
    const waMessage = `Salaam! Your order has been confirmed. Login here with your number to track: ${portalUrl}`;

    // SINGLE edge function call: activate company + create order + mark webhooks + send WhatsApp
    const { data, error } = await supabase.functions.invoke("admin-create-draft", {
      body: {
        company_id: editingCompany.id,
        sku_names: skuNames,
        webhook_ids: unattached.map((m) => m.id),
        activate_company: true,
        company_update: {
          business_name: form.business_name,
          gst_number: form.gst_number || null,
          fssai_number: form.fssai_number || null,
          registered_address: form.registered_address || null,
        },
        send_whatsapp_to: clientPhone.length >= 10 ? clientPhone : null,
        whatsapp_message: clientPhone.length >= 10 ? waMessage : null,
      },
    });

    if (error || !data?.ok) {
      toast.error("Activation failed: " + (data?.error || error?.message || "Unknown error"));
      setSaving(false);
      return;
    }

    // SUCCESS — edge function returned 200, DB writes are confirmed
    const msgCount = unattached.length;
    toast.success(`${form.business_name} activated & verified! Draft SO #${data.order_id.slice(0, 8).toUpperCase()} created.${msgCount > 0 ? ` ${msgCount} message(s) attached.` : ""}`);

    setSaving(false);
    setEditingCompany(null);
    onRefresh();
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
            const phone = extractPhone(c);
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
                      <span>{phone || "No phone"}</span>
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle size={18} className="text-primary" /> Verify & Activate Client
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {scanningHistory && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-3 justify-center">
                <Search size={14} className="animate-pulse" /> Scanning WhatsApp history…
              </div>
            )}

            {historyScanned && historyMessages.length > 0 && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <p className="text-xs font-bold text-blue-500 mb-2 flex items-center gap-1.5">
                  <Search size={12} /> {historyMessages.length} Unprocessed Message{historyMessages.length > 1 ? "s" : ""} Found
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {historyMessages.map((m) => (
                    <div key={m.id} className="text-[10px] bg-background rounded p-2 border border-border">
                      <p className="text-foreground truncate">{extractText(m.raw_payload) || "Non-text message"}</p>
                      <p className="text-muted-foreground mt-0.5">{new Date(m.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-blue-400 mt-2 flex items-center gap-1">
                  <ArrowRight size={10} /> These will be attached as Draft Orders on confirmation
                </p>
              </div>
            )}

            {historyScanned && historyMessages.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5">
                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                <span>New Lead — No WhatsApp history detected for this number.</span>
              </div>
            )}

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
              {saving ? "Verifying in DB…" : `✅ Confirm & Activate${historyMessages.length > 0 ? ` (+ ${historyMessages.length} messages)` : ""}`}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
