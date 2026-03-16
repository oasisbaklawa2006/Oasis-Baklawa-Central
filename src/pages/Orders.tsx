import AppShell from "@/components/AppShell";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ChevronDown, Package, CheckCircle2, Truck, BoxIcon, CreditCard, ClipboardList, FileText, MessageSquare, ArrowRight, Phone, AlertCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import SupportTicketModal from "@/components/SupportTicketModal";
import ClaimModal from "@/components/ClaimModal";

import pistachioImg from "@/assets/baklawa-pistachio.jpg";
import cashewImg from "@/assets/baklawa-cashew.jpg";
import walnutImg from "@/assets/baklawa-walnut.jpg";

type OrderStatus = "unpaid" | "production" | "delivered" | "completed";

interface Order {
  id: string;
  date: string;
  value: string;
  status: OrderStatus;
  statusLabel: string;
  image: string;
  productName: string;
  timeline: { label: string; done: boolean }[];
  documents: { name: string; type: string }[];
  supportDaysRemaining?: number;
  fulfillment?: { ordered: number; packed: number; shortfall: number };
}

const statusStyles: Record<OrderStatus, string> = {
  unpaid: "bg-destructive/10 text-destructive border-destructive/20",
  production: "bg-blue-50 text-blue-600 border-blue-200",
  delivered: "bg-green-50 text-green-600 border-green-200",
  completed: "bg-muted text-muted-foreground border-border",
};

const filterChips = ["All", "Unpaid", "Undelivered", "Issues Pending", "Completed"];

const orders: Order[] = [
  {
    id: "ORD-2026-089", date: "12 Mar 2026", value: "₹82,000", status: "unpaid", statusLabel: "Unpaid Advance",
    image: pistachioImg, productName: "Pistachio Baklawa × 20 Cartons",
    timeline: [
      { label: "Order Placed", done: true }, { label: "Advance Paid", done: false },
      { label: "Production", done: false }, { label: "Packing", done: false },
      { label: "Dispatched", done: false }, { label: "Delivered", done: false },
    ],
    documents: [{ name: "Invoice INV-089", type: "invoice" }, { name: "LR Copy (Transport)", type: "lr" }],
  },
  {
    id: "ORD-2026-074", date: "28 Feb 2026", value: "₹1,45,000", status: "production", statusLabel: "Dispatched",
    image: cashewImg, productName: "Cashew Roll Baklawa × 35 Cartons",
    fulfillment: { ordered: 35, packed: 30, shortfall: 5 },
    timeline: [
      { label: "Order Placed", done: true }, { label: "Advance Paid", done: true },
      { label: "Production", done: true }, { label: "Packing", done: true },
      { label: "Dispatched", done: true }, { label: "Delivered", done: false },
    ],
    documents: [{ name: "Invoice INV-074", type: "invoice" }, { name: "LR Copy (Transport)", type: "lr" }],
  },
  {
    id: "ORD-2026-051", date: "10 Feb 2026", value: "₹63,500", status: "delivered", statusLabel: "Delivered - Ticket Open",
    image: walnutImg, productName: "Walnut Diamond Cut × 15 Cartons",
    supportDaysRemaining: 8,
    timeline: [
      { label: "Order Placed", done: true }, { label: "Advance Paid", done: true },
      { label: "Production", done: true }, { label: "Packing", done: true },
      { label: "Dispatched", done: true }, { label: "Delivered", done: true },
    ],
    documents: [{ name: "Invoice INV-051", type: "invoice" }, { name: "LR Copy (Transport)", type: "lr" }],
  },
];

const timelineIcons = [ClipboardList, CreditCard, Package, BoxIcon, Truck, CheckCircle2];

const Orders = () => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("All");
  const [ticketOrder, setTicketOrder] = useState<string | null>(null);
  const [claimOrder, setClaimOrder] = useState<string | null>(null);
  const navigate = useNavigate();

  const filteredOrders = orders.filter((o) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Unpaid") return o.status === "unpaid";
    if (activeFilter === "Undelivered") return o.status === "production" || o.status === "unpaid";
    if (activeFilter === "Issues Pending") return o.statusLabel.includes("Ticket");
    if (activeFilter === "Completed") return o.status === "completed" || o.status === "delivered";
    return true;
  });

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6">
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-display-h1 text-foreground">
          Order History
        </motion.h1>

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {filterChips.map((chip) => (
            <button
              key={chip}
              onClick={() => setActiveFilter(chip)}
              className={`px-4 py-2 rounded-full text-ui-button whitespace-nowrap transition-colors border ${
                activeFilter === chip
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filteredOrders.map((order, i) => {
            const isOpen = expanded === order.id;
            const isDispatchedOrDelivered = order.status === "delivered" || order.statusLabel.toLowerCase().includes("dispatched");
            return (
              <motion.div key={order.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-card rounded-2xl shadow-card overflow-hidden">
                <button onClick={() => setExpanded(isOpen ? null : order.id)} className="w-full p-4 flex items-center gap-4 text-left">
                  <img src={order.image} alt={order.productName} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-ui-h5 text-foreground">{order.id}</p>
                    <p className="text-ui-cell text-muted-foreground truncate">{order.productName}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="text-ui-cell text-muted-foreground">{order.date}</p>
                      <span className="text-muted-foreground">·</span>
                      <p className="text-ui-kpi text-sm text-foreground">{order.value}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <Badge className={`text-fine border ${statusStyles[order.status]}`}>{order.statusLabel}</Badge>
                    <ChevronDown size={18} className={`text-muted-foreground transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                      <div className="px-5 pb-5 pt-1 space-y-5">
                        {/* Timeline */}
                        <div className="border-t border-border pt-4">
                          {order.timeline.map((step, si) => {
                            const Icon = timelineIcons[si];
                            const isLast = si === order.timeline.length - 1;
                            return (
                              <div key={si} className="flex gap-3">
                                <div className="flex flex-col items-center">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${step.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                    <Icon size={14} />
                                  </div>
                                  {!isLast && <div className={`w-0.5 h-6 ${step.done ? "bg-primary" : "bg-border"}`} />}
                                </div>
                                <p className={`text-body-p2 pt-1.5 ${step.done ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{step.label}</p>
                              </div>
                            );
                          })}
                        </div>

                        {/* Fulfillment Summary */}
                        {order.fulfillment && (
                          <div className="border-t border-border pt-4">
                            <div className="bg-primary/5 rounded-xl p-4 border border-primary/15 space-y-3">
                              <h3 className="text-ui-h5 text-foreground flex items-center gap-2"><Package size={14} className="text-primary" /> Fulfillment Summary</h3>
                              <div className="space-y-2">
                                {[
                                  { label: "Ordered Quantity", val: `${order.fulfillment.ordered} Cartons`, cls: "text-foreground" },
                                  { label: "Packed / Invoiced", val: `${order.fulfillment.packed} Cartons`, cls: "text-foreground" },
                                  { label: "Shortfall / Pending", val: `${order.fulfillment.shortfall} Cartons`, cls: "text-destructive" },
                                ].map((r) => (
                                  <div key={r.label} className="flex justify-between">
                                    <span className="text-fine text-muted-foreground">{r.label}</span>
                                    <span className={`text-ui-cell font-semibold ${r.cls}`}>{r.val}</span>
                                  </div>
                                ))}
                              </div>
                              <p className="text-fine-xs text-muted-foreground italic border-t border-border/50 pt-2">Final Invoice generated from Packed Quantity only.</p>
                            </div>
                          </div>
                        )}

                        {/* Raise Issue / Claim Button */}
                        {isDispatchedOrDelivered && (
                          <div className="border-t border-border pt-4">
                            <button
                              onClick={(e) => { e.stopPropagation(); setClaimOrder(order.id); }}
                              className="w-full py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-ui-button flex items-center justify-center gap-2 hover:bg-destructive/15 transition-colors"
                            >
                              <AlertCircle size={14} />
                              Raise Issue / Claim
                            </button>
                          </div>
                        )}

                        {/* 10-Day Support Window */}
                        {order.status === "delivered" && order.supportDaysRemaining && order.supportDaysRemaining > 0 && (
                          <div className="border-t border-border pt-4">
                            <div className="bg-green-50 rounded-xl p-4 border border-green-200 space-y-3">
                              <div className="flex items-center gap-2">
                                <Clock size={14} className="text-green-600" />
                                <span className="text-ui-label text-green-600">Support Window Open ({order.supportDaysRemaining} Days Remaining)</span>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); setTicketOrder(order.id); }}
                                className="w-full py-2.5 rounded-xl bg-card border border-border text-foreground text-ui-button flex items-center justify-center gap-2 hover:border-destructive/50 transition-colors"
                              >
                                <AlertCircle size={14} className="text-destructive" />
                                Raise Ticket / Report Issue
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Delivery Tracking */}
                        {order.timeline.find(s => s.label === "Dispatched")?.done && !order.timeline.find(s => s.label === "Delivered")?.done && (
                          <div className="border-t border-border pt-4">
                            <div className="bg-primary/5 rounded-xl p-4 border border-primary/15 space-y-2">
                              <div className="flex items-center gap-2">
                                <Truck size={14} className="text-primary" />
                                <h3 className="text-ui-h5 text-foreground">Live Tracking</h3>
                              </div>
                              <div className="space-y-1.5">
                                {[
                                  { label: "Transporter", value: "Blue Dart" },
                                  { label: "Tracking LR", value: "849302" },
                                ].map(r => (
                                  <div key={r.label} className="flex justify-between">
                                    <span className="text-fine text-muted-foreground">{r.label}</span>
                                    <span className="text-ui-cell font-semibold text-foreground">{r.value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Document Center */}
                        <div className="border-t border-border pt-4 space-y-3">
                          <h3 className="text-ui-h5 text-foreground flex items-center gap-2"><FileText size={14} className="text-primary" /> Document Center</h3>
                          {order.documents.map((doc, di) => (
                            <div key={di} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-muted/40 border border-border/50">
                              <div className="flex items-center gap-2.5">
                                <FileText size={14} className="text-muted-foreground" />
                                <p className="text-body-p2 text-foreground">{doc.name}</p>
                              </div>
                              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 transition-colors" onClick={(e) => e.stopPropagation()}>
                                <MessageSquare size={13} className="text-green-600" />
                                <span className="text-ui-label text-green-600">Share</span>
                              </button>
                            </div>
                          ))}
                          <button onClick={(e) => { e.stopPropagation(); navigate("/documents"); }} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/15 transition-colors mt-1">
                            <FileText size={14} className="text-primary" />
                            <span className="text-ui-button text-primary">Go to Document Center</span>
                            <ArrowRight size={12} className="text-primary" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      <SupportTicketModal open={!!ticketOrder} onClose={() => setTicketOrder(null)} orderId={ticketOrder || ""} />
      <ClaimModal open={!!claimOrder} onClose={() => setClaimOrder(null)} orderId={claimOrder || ""} />
    </AppShell>
  );
};

export default Orders;
