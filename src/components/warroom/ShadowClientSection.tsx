import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Phone, Building2, Edit2, CheckCircle, Package, Search, ArrowRight, AlertTriangle, Trash2, UserCog, Ban } from "lucide-react";
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

interface ActiveCompany { id: string; business_name: string; }
interface EmployeeUser { id: string; full_name: string | null; email: string | null; role: string | null; phone: string | null; }

interface Props {
  companies: ShadowCompany[];
  onRefresh: () => void;
}

type EntityCategory = "client" | "employee" | "other";
type ActionType = "link" | "create";

export default function ShadowClientSection({ companies, onRefresh }: Props) {
  const [editingCompany, setEditingCompany] = useState<ShadowCompany | null>(null);
  const [form, setForm] = useState({ business_name: "", gst_number: "", fssai_number: "", registered_address: "" });
  const [saving, setSaving] = useState(false);
  const [draftOrders, setDraftOrders] = useState<Record<string, DraftOrderInfo[]>>({});
  const [historyMessages, setHistoryMessages] = useState<HistoryMessage[]>([]);
  const [scanningHistory, setScanningHistory] = useState(false);
  const [historyScanned, setHistoryScanned] = useState(false);

  // Triage state
  const [entityCategory, setEntityCategory] = useState<EntityCategory>("client");
  const [actionType, setActionType] = useState<ActionType>("create");
  const [selectedExistingId, setSelectedExistingId] = useState<string>("");
  const [activeCompanies, setActiveCompanies] = useState<ActiveCompany[]>([]);
  const [employees, setEmployees] = useState<EmployeeUser[]>([]);

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
    setEntityCategory("client");
    setActionType("create");
    setSelectedExistingId("");
    setForm({
      business_name: c.business_name.replace(" (WhatsApp)", ""),
      gst_number: c.gst_number?.startsWith("WA:") ? "" : c.gst_number || "",
      fssai_number: c.fssai_number || "",
      registered_address: c.registered_address || "",
    });

    // Fetch active companies + employees in parallel for link options
    const [{ data: comps }, { data: users }] = await Promise.all([
      supabase.from("companies").select("id, business_name").eq("status", "active").order("business_name").limit(500),
      supabase.from("users").select("id, full_name, email, role, phone").not("role", "is", null).order("full_name").limit(500),
    ]);
    setActiveCompanies((comps as ActiveCompany[]) ?? []);
    setEmployees((users as EmployeeUser[]) ?? []);

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
    const webhookIds = unattached.map((m) => m.id);
    const clientPhone = extractPhone(editingCompany);
    const digits = extractPhoneDigits(editingCompany);
    const formattedPhone = digits ? `+${digits}` : clientPhone;

    try {
      // === SPAM / OTHER: archive shadow + discard messages ===
      if (entityCategory === "other") {
        const { error: rejErr } = await supabase
          .from("companies")
          .update({ status: "rejected" } as any)
          .eq("id", editingCompany.id);
        if (rejErr) throw rejErr;

        if (webhookIds.length > 0) {
          await supabase
            .from("debug_webhooks")
            .update({ processed: true, discard_reason: "spam_or_other" } as any)
            .in("id", webhookIds);
        }
        toast.success(`Lead archived as Spam/Other. ${webhookIds.length} message(s) discarded.`);
        setSaving(false);
        setEditingCompany(null);
        onRefresh();
        return;
      }

      // === LINK to existing client ===
      if (entityCategory === "client" && actionType === "link") {
        if (!selectedExistingId) { toast.error("Select a client to link"); setSaving(false); return; }

        // Update existing company phone if missing
        await supabase
          .from("companies")
          .update({ phone: formattedPhone } as any)
          .eq("id", selectedExistingId);

        // Re-point any existing draft orders from shadow → real company
        await supabase
          .from("orders")
          .update({ company_id: selectedExistingId } as any)
          .eq("company_id", editingCompany.id);

        // Mark webhooks processed
        if (webhookIds.length > 0) {
          await supabase.from("debug_webhooks").update({ processed: true } as any).in("id", webhookIds);
        }

        // Hide the shadow company
        await supabase.from("companies").update({ status: "merged" } as any).eq("id", editingCompany.id);

        toast.success(`Linked to existing client. ${webhookIds.length} message(s) attached.`);
        setSaving(false);
        setEditingCompany(null);
        onRefresh();
        return;
      }

      // === LINK to existing employee ===
      if (entityCategory === "employee" && actionType === "link") {
        if (!selectedExistingId) { toast.error("Select an employee to link"); setSaving(false); return; }

        const emp = employees.find((e) => e.id === selectedExistingId);
        if (!emp) { toast.error("Employee not found"); setSaving(false); return; }

        // Append to secondary_phones if primary already set, else set primary
        if (emp.phone && emp.phone.trim().length > 0 && emp.phone !== formattedPhone) {
          const { data: cur } = await supabase.from("users").select("secondary_phones").eq("id", emp.id).maybeSingle();
          const arr = (cur as any)?.secondary_phones ?? [];
          if (!arr.includes(formattedPhone)) {
            await supabase.from("users").update({ secondary_phones: [...arr, formattedPhone] } as any).eq("id", emp.id);
          }
        } else {
          await supabase.from("users").update({ phone: formattedPhone } as any).eq("id", emp.id);
        }

        if (webhookIds.length > 0) {
          await supabase.from("debug_webhooks").update({ processed: true, discard_reason: "employee_sender" } as any).in("id", webhookIds);
        }

        // Soft-hide shadow company
        await supabase.from("companies").update({ status: "rejected" } as any).eq("id", editingCompany.id);

        toast.success(`Phone linked to ${emp.full_name || emp.email}. ${webhookIds.length} message(s) tagged.`);
        setSaving(false);
        setEditingCompany(null);
        onRefresh();
        return;
      }

      // === EMPLOYEE + CREATE: not supported here, redirect to AdminUsers ===
      if (entityCategory === "employee" && actionType === "create") {
        toast.error("Create new employees from Admin → Users. Use 'Link to Existing' here.");
        setSaving(false);
        return;
      }

      // === CLIENT + CREATE (default): activate shadow as new client ===
      const portalUrl = "https://b2b.oasisbaklawa.com/login";
      const waMessage = `Salaam! Your order has been confirmed. Login here with your number to track: ${portalUrl}`;

      const { data, error } = await supabase.functions.invoke("admin-create-draft", {
        body: {
          company_id: editingCompany.id,
          sku_names: [],
          webhook_ids: webhookIds,
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

      toast.success(`${form.business_name} activated! Draft SO #${data.order_id.slice(0, 8).toUpperCase()} created.${webhookIds.length > 0 ? ` ${webhookIds.length} message(s) attached.` : ""}`);
      setSaving(false);
      setEditingCompany(null);
      onRefresh();
    } catch (e: any) {
      toast.error("Operation failed: " + (e?.message || "Unknown error"));
      setSaving(false);
    }
  };

  if (companies.length === 0) return null;

  const editingDrafts = editingCompany ? draftOrders[editingCompany.id] || [] : [];

  // Submit button disabled logic
  const submitDisabled = saving || (() => {
    if (entityCategory === "other") return false;
    if (actionType === "link") return !selectedExistingId;
    if (entityCategory === "employee" && actionType === "create") return true;
    return !form.business_name.trim(); // client + create
  })();

  const submitLabel = saving
    ? "Processing…"
    : entityCategory === "other"
      ? `🗑 Archive as Spam${historyMessages.length > 0 ? ` (discard ${historyMessages.length})` : ""}`
      : actionType === "link"
        ? `🔗 Link & Attach${historyMessages.length > 0 ? ` ${historyMessages.length} msg(s)` : ""}`
        : `✅ Confirm & Activate${historyMessages.length > 0 ? ` (+ ${historyMessages.length})` : ""}`;

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
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => openEdit(c)}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-md border border-primary/20 hover:bg-primary/5"
                  >
                    <Edit2 size={12} /> Triage
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Reject lead "${c.business_name}"? It will be hidden from the queue (record kept in DB).`)) return;
                      const { error } = await supabase
                        .from("companies")
                        .update({ status: "rejected" } as any)
                        .eq("id", c.id);
                      if (error) { toast.error("Failed to reject lead"); return; }
                      toast.success("Lead rejected & hidden");
                      onRefresh();
                    }}
                    className="flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md border border-border hover:border-destructive/40 hover:bg-destructive/5"
                    title="Reject lead (soft-hide, log retained)"
                    aria-label="Reject lead"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={!!editingCompany} onOpenChange={(o) => !o && setEditingCompany(null)}>
        <DialogContent className="sm:max-w-lg bg-card border-border rounded-3xl p-6 h-fit my-auto max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle size={18} className="text-primary" /> Triage WhatsApp Lead
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {/* Phone identity badge */}
            {editingCompany && (
              <div className="flex items-center gap-2 text-xs bg-muted/40 rounded-lg px-3 py-2 border border-border">
                <Phone size={12} className="text-muted-foreground" />
                <span className="font-mono text-foreground">{extractPhone(editingCompany) || "No phone"}</span>
              </div>
            )}

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
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {historyMessages.map((m) => (
                    <div key={m.id} className="text-[10px] bg-background rounded p-2 border border-border">
                      <p className="text-foreground truncate">{extractText(m.raw_payload) || "Non-text message"}</p>
                      <p className="text-muted-foreground mt-0.5">{new Date(m.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {historyScanned && historyMessages.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5">
                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                <span>New Lead — No WhatsApp history detected for this number.</span>
              </div>
            )}

            {/* === TRIAGE: Category Picker === */}
            <div>
              <label className="text-xs font-bold text-foreground mb-1.5 block uppercase tracking-wider">Who is this?</label>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { val: "client", label: "Client", icon: Building2 },
                  { val: "employee", label: "Employee", icon: UserCog },
                  { val: "other", label: "Spam/Other", icon: Ban },
                ] as { val: EntityCategory; label: string; icon: any }[]).map((opt) => {
                  const Icon = opt.icon;
                  const active = entityCategory === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => { setEntityCategory(opt.val); setSelectedExistingId(""); if (opt.val === "employee") setActionType("link"); }}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-semibold transition-all ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <Icon size={14} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* === Action toggle (Client / Employee only) === */}
            {entityCategory !== "other" && (
              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block uppercase tracking-wider">Action</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActionType("link")}
                    className={`py-2 rounded-lg border text-xs font-semibold transition-all ${
                      actionType === "link"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    🔗 Link to Existing
                  </button>
                  <button
                    type="button"
                    disabled={entityCategory === "employee"}
                    onClick={() => setActionType("create")}
                    className={`py-2 rounded-lg border text-xs font-semibold transition-all ${
                      actionType === "create"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    ➕ Create New
                  </button>
                </div>
                {entityCategory === "employee" && (
                  <p className="text-[10px] text-muted-foreground mt-1">New employees must be created from Admin → Users.</p>
                )}
              </div>
            )}

            {/* === SPAM/OTHER warning === */}
            {entityCategory === "other" && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
                <AlertTriangle size={16} className="text-destructive flex-shrink-0 mt-0.5" />
                <div className="text-xs text-foreground">
                  <p className="font-bold text-destructive mb-1">This will be archived</p>
                  <p className="text-muted-foreground">The shadow lead will be soft-hidden and all {historyMessages.length} unprocessed message(s) will be marked as discarded spam.</p>
                </div>
              </div>
            )}

            {/* === LINK: Client dropdown === */}
            {entityCategory === "client" && actionType === "link" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Select Client *</label>
                <select
                  value={selectedExistingId}
                  onChange={(e) => setSelectedExistingId(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none appearance-none"
                >
                  <option value="">— Choose a client —</option>
                  {activeCompanies.map((co) => (
                    <option key={co.id} value={co.id}>{co.business_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* === LINK: Employee dropdown === */}
            {entityCategory === "employee" && actionType === "link" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Select Employee *</label>
                <select
                  value={selectedExistingId}
                  onChange={(e) => setSelectedExistingId(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none appearance-none"
                >
                  <option value="">— Choose an employee —</option>
                  {employees.map((u) => (
                    <option key={u.id} value={u.id}>
                      {(u.full_name || u.email || "Unnamed")}{u.role ? ` · ${u.role}` : ""}{u.phone ? ` · ${u.phone}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* === CREATE NEW CLIENT form === */}
            {entityCategory === "client" && actionType === "create" && (
              <>
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
              </>
            )}

            <button
              onClick={handleConfirm}
              disabled={submitDisabled}
              className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 ${
                entityCategory === "other"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {submitLabel}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
