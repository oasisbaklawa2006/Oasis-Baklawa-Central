import AppShell from "@/components/AppShell";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ChevronDown, Package, CheckCircle2, Truck, BoxIcon, CreditCard, ClipboardList, FileText, MessageSquare, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

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
}

const statusStyles: Record<OrderStatus, string> = {
  unpaid: "bg-destructive/10 text-destructive border-destructive/20",
  production: "bg-blue-50 text-blue-600 border-blue-200",
  delivered: "bg-green-50 text-green-600 border-green-200",
  completed: "bg-muted text-muted-foreground border-border",
};

const orders: Order[] = [
  {
    id: "ORD-2026-089",
    date: "12 Mar 2026",
    value: "₹82,000",
    status: "unpaid",
    statusLabel: "Unpaid Advance",
    image: pistachioImg,
    productName: "Pistachio Baklawa × 20 Cartons",
    timeline: [
      { label: "Order Placed", done: true },
      { label: "Advance Paid", done: false },
      { label: "Production", done: false },
      { label: "Packing", done: false },
      { label: "Dispatched", done: false },
      { label: "Delivered", done: false },
    ],
    documents: [
      { name: "Invoice INV-089", type: "invoice" },
      { name: "LR Copy (Transport)", type: "lr" },
    ],
  },
  {
    id: "ORD-2026-074",
    date: "28 Feb 2026",
    value: "₹1,45,000",
    status: "production",
    statusLabel: "In Production",
    image: cashewImg,
    productName: "Cashew Roll Baklawa × 35 Cartons",
    timeline: [
      { label: "Order Placed", done: true },
      { label: "Advance Paid", done: true },
      { label: "Production", done: true },
      { label: "Packing", done: false },
      { label: "Dispatched", done: false },
      { label: "Delivered", done: false },
    ],
    documents: [
      { name: "Invoice INV-074", type: "invoice" },
      { name: "LR Copy (Transport)", type: "lr" },
    ],
  },
  {
    id: "ORD-2026-051",
    date: "10 Feb 2026",
    value: "₹63,500",
    status: "delivered",
    statusLabel: "Delivered - Ticket Open",
    image: walnutImg,
    productName: "Walnut Diamond Cut × 15 Cartons",
    timeline: [
      { label: "Order Placed", done: true },
      { label: "Advance Paid", done: true },
      { label: "Production", done: true },
      { label: "Packing", done: true },
      { label: "Dispatched", done: true },
      { label: "Delivered", done: true },
    ],
    documents: [
      { name: "Invoice INV-051", type: "invoice" },
      { name: "LR Copy (Transport)", type: "lr" },
    ],
  },
];

const timelineIcons = [ClipboardList, CreditCard, Package, BoxIcon, Truck, CheckCircle2];

const Orders = () => {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-2xl md:text-3xl tracking-wide text-foreground"
        >
          Order History
        </motion.h1>

        <div className="space-y-4">
          {orders.map((order, i) => {
            const isOpen = expanded === order.id;
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-card rounded-2xl shadow-card overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                  className="w-full p-4 flex items-center gap-4 text-left"
                >
                  <img src={order.image} alt={order.productName} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-bold text-foreground text-sm">{order.id}</p>
                    <p className="font-body text-xs text-muted-foreground truncate">{order.productName}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="font-body text-xs text-muted-foreground">{order.date}</p>
                      <span className="text-muted-foreground">·</span>
                      <p className="font-body text-sm font-semibold text-foreground">{order.value}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <Badge className={`text-[11px] border ${statusStyles[order.status]}`}>
                      {order.statusLabel}
                    </Badge>
                    <ChevronDown size={18} className={`text-muted-foreground transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
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
                                <p className={`font-body text-sm pt-1.5 ${step.done ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                                  {step.label}
                                </p>
                              </div>
                            );
                          })}
                        </div>

                        {/* Document Center */}
                        <div className="border-t border-border pt-4 space-y-3">
                          <h3 className="font-body font-bold text-foreground text-sm flex items-center gap-2">
                            <FileText size={14} className="text-primary" />
                            Document Center
                          </h3>
                          {order.documents.map((doc, di) => (
                            <div key={di} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-muted/40 border border-border/50">
                              <div className="flex items-center gap-2.5">
                                <FileText size={14} className="text-muted-foreground" />
                                <p className="font-body text-sm text-foreground">{doc.name}</p>
                              </div>
                              <button
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MessageSquare size={13} className="text-green-600" />
                                <span className="font-body text-xs font-semibold text-green-600">Share</span>
                              </button>
                            </div>
                          ))}
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
    </AppShell>
  );
};

export default Orders;
