import AppShell from "@/components/AppShell";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2, ChevronLeft, CheckCircle2, Circle, Clock, MessageSquarePlus,
  Package, Settings, Wrench, Box, FileText, Truck, MapPin, ShieldCheck, X,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const ORDER_STEPS = [
  { key: "submitted", label: "Order Placed", icon: Package },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { key: "in_production", label: "Manufacturing", icon: Settings },
  { key: "assembly", label: "Assembly", icon: Wrench },
  { key: "packing", label: "Packing", icon: Box },
  { key: "invoice_generated", label: "Invoice Generated", icon: FileText },
  { key: "dispatched", label: "Dispatched", icon: Truck },
  { key: "in_transit", label: "In Transit", icon: MapPin },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
  { key: "support_window", label: "10-Day Support", icon: ShieldCheck },
];

function getStepIndex(status: string): number {
  const map: Record<string, number> = {
    submitted: 0, pending: 0,
    confirmed: 1, approved: 1,
    in_production: 2, manufacturing: 2, processing: 2,
    assembly: 3,
    packing: 4, packed_ready: 4,
    invoice_generated: 5,
    dispatched: 6,
    in_transit: 7,
    delivered: 8,
    support_window: 9, closed: 9,
  };
  return map[status?.toLowerCase()] ?? 0;
}

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN");
const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const OrderTracking = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketType, setTicketType] = useState("damaged_goods");
  const [ticketDesc, setTicketDesc] = useState("");
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [existingTickets, setExistingTickets] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    const fetchOrder = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select(
          "*, company:companies(business_name), order_items(*, product:products(name, image_url, pack_size))"
        )
        .eq("id", id)
        .single();
      if (!error && data) setOrder(data);
      
      const { data: tickets } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("order_id", id)
        .order("created_at", { ascending: false });
      if (tickets) setExistingTickets(tickets);
      
      setLoading(false);
    };
    fetchOrder();
  }, [id]);

  const handleSubmitTicket = async () => {
    if (!id || !ticketDesc.trim()) {
      toast.error("Please describe your issue.");
      return;
    }
    setSubmittingTicket(true);
    const { error } = await supabase.from("support_tickets").insert({
      order_id: id,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      issue_type: ticketType,
      description: ticketDesc,
      status: "open",
    });
    setSubmittingTicket(false);
    if (error) {
      toast.error("Failed to submit ticket. Please try again.");
      return;
    }
    toast.success("Support ticket raised successfully!");
    setShowTicketForm(false);
    setTicketDesc("");
    const { data: tickets } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: false });
    if (tickets) setExistingTickets(tickets);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 size={32} className="animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground text-sm font-medium">Loading order...</p>
        </div>
      </AppShell>
    );
  }

  if (!order) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <Package size={48} className="text-muted-foreground/30" />
          <h1 className="font-display text-xl">Order not found</h1>
          <button onClick={() => navigate("/orders")} className="text-primary font-bold text-sm">
            ← Back to Orders
          </button>
        </div>
      </AppShell>
    );
  }

  const currentStep = getStepIndex(order.status);
  const isInSupportWindow = currentStep >= 8;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 pb-28 space-y-6">
        <div className="flex items-center gap-3 pt-6">
          <button onClick={() => navigate("/orders")} className="p-2 -ml-2 hover:bg-muted rounded-full">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="font-display text-xl tracking-wide">Order <span className="font-number font-medium">#{order.id.split("-")[0]}</span></h1>
            <p className="text-xs text-muted-foreground font-number font-medium">{formatDate(order.created_at)}</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Order Value</p>
            <p className="font-number text-2xl font-semibold text-foreground">{formatPrice(order.sales_order_value || 0)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground font-medium">Company</p>
            <p className="text-sm font-semibold text-foreground">{order.company?.business_name || "—"}</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="font-display text-base mb-5">Order Timeline</h2>
          <div className="relative">
            {ORDER_STEPS.map((step, i) => {
              const isCompleted = i <= currentStep;
              const isCurrent = i === currentStep;
              const StepIcon = step.icon;

              return (
                <div key={step.key} className="flex items-start gap-4 relative">
                  {i < ORDER_STEPS.length - 1 && (
                    <div
                      className={`absolute left-[17px] top-[36px] w-0.5 h-[calc(100%-4px)] ${
                        i < currentStep ? "bg-primary" : "bg-border"
                      }`}
                    />
                  )}
                  <div
                    className={`relative z-10 w-[36px] h-[36px] rounded-full flex items-center justify-center shrink-0 ${
                      isCompleted
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    } ${isCurrent ? "ring-2 ring-primary/30 ring-offset-2 ring-offset-background" : ""}`}
                  >
                    {isCompleted ? <StepIcon size={16} /> : <Circle size={16} />}
                  </div>
                  <div className={`pb-6 ${isCurrent ? "pt-0" : ""}`}>
                    <p
                      className={`text-sm font-semibold ${
                        isCompleted ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </p>
                    {isCurrent && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-[10px] text-primary font-bold uppercase tracking-wider"
                      >
                        Current Status
                      </motion.span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {order.order_items?.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-5">
            <h2 className="font-display text-base mb-3">Items ({order.order_items.length})</h2>
            <div className="space-y-3">
              {order.order_items.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                    {item.product?.image_url ? (
                      <img src={item.product.image_url} alt="" className="w-8 h-8 object-contain" />
                    ) : (
                      <Package size={16} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {item.product?.name || "Product"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isInSupportWindow && (
          <div className="bg-accent/10 rounded-2xl border border-accent p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-primary" />
              <h2 className="font-display text-base">10-Day Support Window</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              You can raise issues with this order within 10 days of delivery. Our team will respond within 24 hours.
            </p>

            {!showTicketForm ? (
              <button
                onClick={() => setShowTicketForm(true)}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2"
              >
                <MessageSquarePlus size={16} /> Raise Issue / Open Ticket
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3 bg-card rounded-xl p-4 border border-border"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-foreground">New Support Ticket</p>
                  <button onClick={() => setShowTicketForm(false)} className="p-1 hover:bg-muted rounded-full">
                    <X size={14} />
                  </button>
                </div>
                <select
                  value={ticketType}
                  onChange={(e) => setTicketType(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="damaged_goods">Damaged Goods</option>
                  <option value="wrong_items">Wrong Items Received</option>
                  <option value="missing_items">Missing Items</option>
                  <option value="quality_issue">Quality Issue</option>
                  <option value="billing_dispute">Billing Dispute</option>
                  <option value="other">Other</option>
                </select>
                <textarea
                  value={ticketDesc}
                  onChange={(e) => setTicketDesc(e.target.value)}
                  placeholder="Describe the issue in detail..."
                  rows={4}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
                />
                <button
                  onClick={handleSubmitTicket}
                  disabled={submittingTicket || !ticketDesc.trim()}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submittingTicket ? <Loader2 size={16} className="animate-spin" /> : null}
                  {submittingTicket ? "Submitting..." : "Submit Ticket"}
                </button>
              </motion.div>
            )}

            {existingTickets.length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Your Tickets</p>
                {existingTickets.map((t) => (
                  <div key={t.id} className="bg-background rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-foreground capitalize">
                        {(t.issue_type || "issue").replace(/_/g, " ")}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          t.status === "open"
                            ? "bg-amber-100 text-amber-700"
                            : t.status === "resolved"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                    {t.resolution_notes && (
                      <p className="text-xs text-primary mt-1">Resolution: {t.resolution_notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default OrderTracking;
