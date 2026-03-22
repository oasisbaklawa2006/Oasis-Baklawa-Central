import AppShell from "@/components/AppShell";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
  Package,
  Clock,
  CheckCircle2,
  ChevronLeft,
  Receipt,
  UploadCloud,
  RefreshCw,
  Loader2,
  FileText,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";
import TopNavBar from "@/components/TopNavBar";
import BottomNavBar from "@/components/BottomNavBar";

const formatPrice = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

const getStatusBadge = (status: string, paymentStatus: string) => {
  if (paymentStatus === "awaiting_utr") {
    return { label: "Awaiting UTR", color: "bg-amber-100 text-amber-800 border-amber-200", icon: <Clock size={12} /> };
  }
  if (paymentStatus === "pending_verification") {
    return {
      label: "Verifying Payment",
      color: "bg-blue-100 text-blue-800 border-blue-200",
      icon: <RefreshCw size={12} className="animate-spin-slow" />,
    };
  }
  if (status === "in_kitchen" || status === "processing") {
    return {
      label: "In Kitchen",
      color: "bg-orange-100 text-orange-800 border-orange-200",
      icon: <Package size={12} />,
    };
  }
  if (status === "dispatched" || status === "transit") {
    return { label: "In Transit", color: "bg-blue-100 text-blue-800 border-blue-200", icon: <Package size={12} /> };
  }
  if (status === "delivered") {
    return {
      label: "Delivered",
      color: "bg-emerald-100 text-emerald-800 border-emerald-200",
      icon: <CheckCircle2 size={12} />,
    };
  }
  return {
    label: "Order Received",
    color: "bg-slate-100 text-slate-800 border-slate-200",
    icon: <CheckCircle2 size={12} />,
  };
};

const Orders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart, fetchCart } = useCart();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // UTR Modal State
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [utrNumber, setUtrNumber] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Claim Modal State (Restored from previous file)
  const [claimOrder, setClaimOrder] = useState<any | null>(null);
  const [issueType, setIssueType] = useState("Damaged Goods");
  const [description, setDescription] = useState("");
  const [submittingClaim, setSubmittingClaim] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          id, 
          created_at, 
          status, 
          payment_status, 
          sales_order_value,
          order_items (
            quantity,
            product_id,
            products (name)
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadUTR = async () => {
    if (!utrNumber.trim()) {
      toast.error("Please enter a valid UTR number.");
      return;
    }

    setIsUploading(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          payment_status: "pending_verification",
        })
        .eq("id", selectedOrder.id);

      if (error) throw error;

      toast.success("UTR Submitted! Awaiting accounts verification.");
      setSelectedOrder(null);
      setUtrNumber("");
      fetchOrders();
    } catch (error) {
      toast.error("Failed to submit UTR. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleReorder = async (orderItems: any[]) => {
    toast.loading("Rebuilding your cart...");
    for (const item of orderItems) {
      await addToCart(item.product_id, item.quantity, "700g", "Standard");
    }
    await fetchCart();
    toast.success("Order copied to your Batch!");
    navigate("/cart");
  };

  const handleDownloadInvoice = () => {
    window.print();
    toast.success("Generating Pro-Forma Invoice...");
  };

  const handleSubmitClaim = async () => {
    if (!description.trim()) {
      toast.error("Please provide a description");
      return;
    }
    setSubmittingClaim(true);

    const { error } = await supabase.from("support_tickets").insert({
      order_id: claimOrder!.id,
      issue_type: issueType,
      description: description.trim(),
      status: "open",
    });

    if (error) {
      toast.error("Failed to submit report");
    } else {
      toast.success("Issue reported. Support ticket generated.");
      setClaimOrder(null);
      setDescription("");
    }
    setSubmittingClaim(false);
  };

  return (
    <AppShell>
      <TopNavBar />
      <div className="px-5 pt-20 space-y-6 pb-32 max-w-3xl mx-auto min-h-screen bg-slate-50">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-slate-200 rounded-full transition-colors">
            <ChevronLeft size={24} className="text-slate-700" />
          </button>
          <div>
            <h1 className="font-display text-2xl tracking-wide text-slate-900 font-bold">Order History</h1>
            <p className="text-xs font-medium text-slate-500 mt-0.5">Track your wholesale shipments</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#B8860B]" />
            <p className="text-sm text-slate-500 mt-4 font-medium">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-900 font-bold">No orders found</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">You haven't placed any wholesale orders yet.</p>
            <button
              onClick={() => navigate("/catalogue")}
              className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-800"
            >
              Browse Catalogue
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const badge = getStatusBadge(order.status, order.payment_status);
              const orderDate = new Date(order.created_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const items = order.order_items || [];
              const totalPacks = items.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0);
              const itemNames = items
                .map((it: any) => it.products?.name)
                .filter(Boolean)
                .join(", ");

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={order.id}
                  className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col"
                >
                  <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        ORDER #{order.id.split("-")[0].toUpperCase()}
                      </p>
                      <p className="text-sm font-bold text-slate-900">{orderDate}</p>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${badge.color}`}
                    >
                      {badge.icon} {badge.label}
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex-1 pr-4">
                        <p className="text-sm font-bold text-slate-900">{totalPacks} Packs Total</p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{itemNames || "Assorted Baklawa"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Value</p>
                        <p className="text-lg font-black text-[#B8860B]">{formatPrice(order.sales_order_value || 0)}</p>
                      </div>
                    </div>

                    {order.status === "delivered" && (
                      <div className="flex justify-end pb-4">
                        <button
                          onClick={() => setClaimOrder(order)}
                          className="text-[11px] font-bold text-rose-500 hover:text-rose-600 underline underline-offset-2"
                        >
                          Report Issue with Shipment
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                      {order.payment_status === "awaiting_utr" ? (
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md"
                        >
                          <UploadCloud size={14} /> Upload UTR
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDownloadInvoice()}
                          className="flex-1 bg-slate-50 text-slate-700 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all border border-slate-200 hover:bg-slate-100"
                        >
                          <FileText size={14} /> Pro-Forma
                        </button>
                      )}
                      <button
                        onClick={() => handleReorder(items)}
                        className="flex-1 bg-[#B8860B]/10 text-[#B8860B] py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all border border-[#B8860B]/20 hover:bg-[#B8860B]/20"
                      >
                        <RefreshCw size={14} /> Reorder
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
      <BottomNavBar />

      {/* UPLOAD UTR MODAL */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm bg-white rounded-3xl p-6 flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-display text-xl font-bold text-slate-900">Upload UTR</h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Order #{selectedOrder.id.split("-")[0].toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-5">
                <p className="text-[10px] font-bold text-amber-800 uppercase tracking-widest mb-0.5">Amount Due</p>
                <p className="text-xl font-black text-amber-900">{formatPrice(selectedOrder.sales_order_value || 0)}</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Bank UTR / Ref Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR1234567890"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#B8860B] focus:ring-1 focus:ring-[#B8860B]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Payment Screenshot
                  </label>
                  <div className="w-full border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50 text-slate-400 cursor-pointer hover:border-[#B8860B] hover:text-[#B8860B] transition-colors">
                    <UploadCloud size={24} className="mb-2" />
                    <p className="text-xs font-bold">Tap to upload receipt</p>
                    <p className="text-[9px] mt-1">JPG, PNG or PDF</p>
                  </div>
                </div>
              </div>
              <div className="pt-6 mt-2">
                <button
                  onClick={handleUploadUTR}
                  disabled={isUploading || !utrNumber.trim()}
                  className="w-full py-3.5 rounded-xl font-bold text-white bg-slate-900 flex justify-center items-center shadow-lg shadow-slate-900/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isUploading ? <Loader2 size={16} className="animate-spin" /> : "Submit for Verification"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SUPPORT CLAIM MODAL */}
      <AnimatePresence>
        {claimOrder && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h2 className="text-xl font-display font-bold text-slate-900">Report Issue</h2>
                  <p className="text-[11px] text-slate-500 mt-1">Order #{claimOrder.id.split("-")[0].toUpperCase()}</p>
                </div>
                <button
                  onClick={() => setClaimOrder(null)}
                  className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
                    Issue Type
                  </label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#B8860B]"
                  >
                    <option>Damaged Goods</option>
                    <option>Missing Items</option>
                    <option>Quality/Staleness</option>
                    <option>Incorrect Delivery</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Please describe the exact issue with this shipment..."
                    className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 h-28 resize-none focus:outline-none focus:ring-1 focus:ring-[#B8860B]"
                  />
                </div>
                <button
                  onClick={handleSubmitClaim}
                  disabled={submittingClaim}
                  className="w-full py-3.5 rounded-xl bg-rose-600 text-white font-bold text-sm flex items-center justify-center hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/20 active:scale-95 disabled:opacity-50"
                >
                  {submittingClaim ? <Loader2 size={16} className="animate-spin" /> : "Submit Support Ticket"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
};

export default Orders;
