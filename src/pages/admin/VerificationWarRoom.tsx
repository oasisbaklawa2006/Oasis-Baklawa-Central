import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, UserCheck, Ghost, Package, ChevronDown, ChevronUp, Edit3,
  CheckCircle, Send, Trash2, Phone, Building2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { sendWhatsAppMessage } from "@/utils/whatsapp";

interface ShadowCompany {
  id: string;
  business_name: string;
  gst_number: string | null;
  created_at: string;
  account_manager_id: string | null;
  status: string;
  website: string | null;
  price_tier: string | null;
}

interface DraftOrder {
  id: string;
  status: string;
  created_at: string;
  sales_order_value: number | null;
  order_items: {
    id: string;
    quantity: number;
    product_id: string | null;
    notes: string | null;
    product: { name: string; image_url: string | null } | null;
  }[];
}

const VerificationWarRoom = () => {
  const [loading, setLoading] = useState(true);
  const [shadows, setShadows] = useState<ShadowCompany[]>([]);
  const [orders, setOrders] = useState<Record<string, DraftOrder[]>>({});
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [editingDetails, setEditingDetails] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ business_name: string; gst_number: string; website: string; price_tier: string }>({
    business_name: "", gst_number: "", website: "", price_tier: "",
  });

  const fetchData = async () => {
    setLoading(true);
    const { data: companies } = await supabase
      .from("companies")
      .select("id, business_name, gst_number, created_at, account_manager_id, status, website, price_tier")
      .eq("status", "shadow")
      .order("created_at", { ascending: false });

    setShadows(companies || []);

    if (companies && companies.length > 0) {
      const companyIds = companies.map((c) => c.id);
      const { data: allOrders } = await supabase
        .from("orders")
        .select("id, status, created_at, sales_order_value, company_id, order_items(id, quantity, product_id, notes, product:products(name, image_url))")
        .in("company_id", companyIds)
        .eq("status", "draft")
        .order("created_at", { ascending: false });

      const grouped: Record<string, DraftOrder[]> = {};
      for (const o of allOrders || []) {
        const cid = (o as any).company_id;
        if (!grouped[cid]) grouped[cid] = [];
        grouped[cid].push(o as any);
      }
      setOrders(grouped);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const extractPhone = (gstField: string | null): string => {
    if (!gstField?.startsWith("WA:")) return "";
    return gstField.replace("WA:", "");
  };

  const handleRename = async (companyId: string) => {
    if (!newName.trim()) return;
    const { error } = await supabase
      .from("companies")
      .update({ business_name: newName.trim() })
      .eq("id", companyId);
    if (error) {
      toast.error("Failed to rename");
      return;
    }
    toast.success("Company renamed");
    setEditingName(null);
    setNewName("");
    fetchData();
  };

  const handleConfirmOnboard = async (company: ShadowCompany) => {
    setConfirmingId(company.id);

    // Upgrade to active status
    const { error } = await supabase
      .from("companies")
      .update({ status: "active" })
      .eq("id", company.id);

    if (error) {
      toast.error("Failed to onboard");
      setConfirmingId(null);
      return;
    }

    // Confirm all draft orders and collect tracking tokens
    const companyOrders = orders[company.id] || [];
    const trackingLinks: string[] = [];
    for (const order of companyOrders) {
      await supabase
        .from("orders")
        .update({ status: "submitted" })
        .eq("id", order.id);

      // Fetch tracking token for Magic Link
      const { data: tokenRow } = await supabase
        .from("orders")
        .select("tracking_token")
        .eq("id", order.id)
        .maybeSingle();

      if (tokenRow?.tracking_token) {
        trackingLinks.push(
          `${window.location.origin}/track?token=${tokenRow.tracking_token}`
        );
      }
    }

    // Send welcome WhatsApp with Magic Link
    const phone = extractPhone(company.gst_number);
    if (phone) {
      const trackingSection = trackingLinks.length > 0
        ? [
            ``,
            `🔗 View your artisan order journey live here:`,
            ...trackingLinks.map((link, i) =>
              companyOrders.length > 1 ? `  Order ${i + 1}: ${link}` : link
            ),
          ].join("\n")
        : "";

      await sendWhatsAppMessage({
        to: phone,
        message: [
          `🎉 Welcome to Oasis Baklawa!`,
          ``,
          `Dear ${company.business_name},`,
          `Your account has been verified and your order${companyOrders.length > 1 ? "s have" : " has"} been confirmed.`,
          trackingSection,
          ``,
          `You will receive tracking updates as your order progresses through our artisan kitchen.`,
          ``,
          `For any queries, reply to this message.`,
          `— Team Oasis Baklawa`,
        ].filter(Boolean).join("\n"),
        companyId: company.id,
      });
      toast.success(`Welcome WhatsApp with tracking link sent to ${phone}`);
    }

    toast.success(`${company.business_name} onboarded successfully!`);
    setConfirmingId(null);
    fetchData();
  };

  const handleDeleteShadow = async (companyId: string) => {
    // Delete draft orders first, then the shadow company
    const companyOrders = orders[companyId] || [];
    for (const order of companyOrders) {
      await supabase.from("order_items").delete().eq("order_id", order.id);
      await supabase.from("orders").delete().eq("id", order.id);
    }
    await supabase.from("companies").delete().eq("id", companyId);
    toast.success("Shadow client removed");
    fetchData();
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Ghost size={28} className="text-primary" />
            Verification War Room
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review shadow accounts from WhatsApp leads. Verify, edit, and onboard.
          </p>
        </div>
        <div className="bg-primary/10 text-primary px-4 py-2 rounded-xl font-bold text-lg">
          {shadows.length} Shadow{shadows.length !== 1 ? "s" : ""}
        </div>
      </div>

      {shadows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <UserCheck size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No shadow clients pending verification</p>
          <p className="text-sm mt-1">New WhatsApp leads will appear here automatically.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shadows.map((company) => {
            const phone = extractPhone(company.gst_number);
            const companyOrders = orders[company.id] || [];
            const isExpanded = expandedCompany === company.id;

            return (
              <motion.div
                key={company.id}
                layout
                className="bg-card border border-border rounded-xl overflow-hidden"
              >
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedCompany(isExpanded ? null : company.id)}
                >
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <Ghost size={20} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground truncate">{company.business_name}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingDetails(editingDetails === company.id ? null : company.id);
                          setEditForm({
                            business_name: company.business_name,
                            gst_number: (company.gst_number || "").replace("WA:", ""),
                            website: company.website || "",
                            price_tier: company.price_tier || "",
                          });
                        }}
                        className="p-1 hover:bg-muted rounded"
                      >
                        <Edit3 size={12} className="text-muted-foreground" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={10} /> {phone}
                        </span>
                      )}
                      <span>{formatDate(company.created_at || "")}</span>
                      <span className="font-bold text-amber-600">{companyOrders.length} draft order{companyOrders.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConfirmOnboard(company);
                      }}
                      disabled={confirmingId === company.id}
                      className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                    >
                      {confirmingId === company.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <CheckCircle size={12} />
                      )}
                      Confirm & Onboard
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteShadow(company.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* INLINE EDIT FORM */}
                <AnimatePresence>
                  {editingDetails === company.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border overflow-hidden"
                    >
                      <div className="p-4 grid grid-cols-2 gap-3" onClick={(e) => e.stopPropagation()}>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Business Name</label>
                          <input value={editForm.business_name} onChange={(e) => setEditForm(f => ({ ...f, business_name: e.target.value }))}
                            className="w-full border border-border rounded px-2 py-1.5 text-sm bg-background mt-1" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">GST Number</label>
                          <input value={editForm.gst_number} onChange={(e) => setEditForm(f => ({ ...f, gst_number: e.target.value }))}
                            className="w-full border border-border rounded px-2 py-1.5 text-sm bg-background mt-1" placeholder="Enter GST" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Website / Address</label>
                          <input value={editForm.website} onChange={(e) => setEditForm(f => ({ ...f, website: e.target.value }))}
                            className="w-full border border-border rounded px-2 py-1.5 text-sm bg-background mt-1" placeholder="Address or website" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Price Tier</label>
                          <select value={editForm.price_tier} onChange={(e) => setEditForm(f => ({ ...f, price_tier: e.target.value }))}
                            className="w-full border border-border rounded px-2 py-1.5 text-sm bg-background mt-1">
                            <option value="">Select…</option>
                            <option value="silver">Silver</option>
                            <option value="gold">Gold</option>
                            <option value="platinum">Platinum</option>
                          </select>
                        </div>
                        <div className="col-span-2 flex gap-2 justify-end">
                          <button onClick={() => setEditingDetails(null)} className="px-3 py-1.5 text-xs text-muted-foreground">Cancel</button>
                          <button
                            onClick={async () => {
                              const { error } = await supabase.from("companies").update({
                                business_name: editForm.business_name.trim(),
                                gst_number: editForm.gst_number.trim() || null,
                                website: editForm.website.trim() || null,
                                price_tier: editForm.price_tier || null,
                              }).eq("id", company.id);
                              if (error) { toast.error("Failed to save"); return; }
                              toast.success("Details updated!");
                              setEditingDetails(null);
                              fetchData();
                            }}
                            className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg"
                          >Save All</button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border overflow-hidden"
                    >
                      <div className="p-4 space-y-3">
                        {companyOrders.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">No draft orders yet.</p>
                        ) : (
                          companyOrders.map((order) => (
                            <div key={order.id} className="bg-muted/30 rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-foreground">
                                  Order #{order.id.split("-")[0]}
                                </span>
                                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase">
                                  {order.status}
                                </span>
                              </div>
                              {order.order_items?.map((item) => (
                                <div key={item.id} className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded bg-background flex items-center justify-center overflow-hidden">
                                    {item.product?.image_url ? (
                                      <img src={item.product.image_url} alt="" className="w-6 h-6 object-contain" />
                                    ) : (
                                      <Package size={12} className="text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold truncate">
                                      {item.product?.name || "Unknown Product"}
                                    </p>
                                    {item.notes && (
                                      <p className="text-[10px] text-muted-foreground truncate">{item.notes}</p>
                                    )}
                                  </div>
                                  <span className="text-xs font-bold text-foreground">×{item.quantity}</span>
                                </div>
                              ))}
                              {order.order_items?.length === 0 && (
                                <div className="flex items-center gap-2 text-xs text-amber-600">
                                  <AlertTriangle size={12} />
                                  <span>No SKU matched — manual review needed</span>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VerificationWarRoom;
