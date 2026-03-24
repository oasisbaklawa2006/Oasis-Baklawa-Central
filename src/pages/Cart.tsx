import AppShell from "@/components/AppShell";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import {
  Package,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Loader2,
  Wand2,
  ChevronLeft,
  CreditCard,
  Banknote,
  Smartphone,
  X,
  Lock,
  Printer,
} from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN");

function getCartonRule(cartonType: string | null) {
  if (cartonType?.toLowerCase().includes("c")) return { packsPerCarton: 9 };
  if (cartonType?.toLowerCase().includes("b")) return { packsPerCarton: 6 };
  if (cartonType?.toLowerCase().includes("a")) return { packsPerCarton: 4 };
  return { packsPerCarton: 4 };
}

function groupByCartonType(items: any[]) {
  const map = new Map<string, any[]>();
  for (const item of items) {
    const key = item.product?.carton_type ?? "Standard";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries()).map(([cartonType, items]) => ({
    cartonType,
    rule: getCartonRule(cartonType),
    items,
  }));
}

const Cart = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("utr");

  const { draftOrder, items, updateQuantity, fetchCart, loading: cartLoading } = useCart();

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (a.product?.name || "").localeCompare(b.product?.name || "")),
    [items],
  );
  const sections = useMemo(() => groupByCartonType(sortedItems), [sortedItems]);

  const subtotal = sortedItems.reduce((sum, item) => sum + item.quantity * (item.product?.price_per_kg || 0), 0);
  const tax = Math.round(subtotal * 0.05);
  const grandTotal = subtotal + tax;

  const hasIncompleteCartons = sections.some((section) => {
    const packs = section.items.reduce((s, it) => s + it.quantity, 0);
    return packs > 0 && packs % section.rule.packsPerCarton !== 0;
  });

  const handleAutoOptimize = async (section: any) => {
    const sectionPacks = section.items.reduce((s: number, it: any) => s + it.quantity, 0);
    const remainder = sectionPacks % section.rule.packsPerCarton;
    if (remainder > 0) {
      const neededToFill = section.rule.packsPerCarton - remainder;
      const targetItem = [...section.items].sort((a, b) => b.quantity - a.quantity)[0];
      await updateQuantity(targetItem.id, targetItem.quantity + neededToFill);
      await fetchCart();
      toast.success(`✨ Carton perfectly optimized!`, { icon: "📦" });
    }
  };

  const handleSmartAdd = async (itemId: string, currentQty: number, needed: number) => {
    await updateQuantity(itemId, currentQty + needed);
    await fetchCart();
    toast.success(`Added ${needed} packs to fill carton!`);
  };

  const handlePrintSO = () => {
    window.print();
    toast.success("Generating Pro-Forma Invoice...");
  };

  const handleFinalSubmit = async () => {
    if (paymentMethod === "gateway") {
      toast.info("Payment Gateway Integration Pending");
      return;
    }
    if (!draftOrder) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "submitted",
          sales_order_value: grandTotal,
          payment_status: "awaiting_receipt",
        })
        .eq("id", draftOrder.id);
      if (error) throw error;
      toast.success("Order logged! Awaiting payment receipt verification.");
      setShowPaymentModal(false);
      setTimeout(() => navigate("/orders"), 1500);
    } catch (error) {
      toast.error("Transaction failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cartLoading)
    return (
      <AppShell>
        <div className="px-5 py-6 flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-[#B8860B]" />
          <p className="mt-4 text-slate-500 font-medium">Fetching your order...</p>
        </div>
      </AppShell>
    );

  if (sortedItems.length === 0)
    return (
      <AppShell>
        <div className="px-5 pt-10 flex flex-col items-center justify-start min-h-[60vh] space-y-4">
          <ShoppingCart size={48} className="text-slate-300" />
          <h1 className="font-display text-2xl tracking-wide">Your Order is Empty</h1>
          <button onClick={() => navigate("/catalogue")} className="text-[#B8860B] font-bold">
            Browse Catalogue
          </button>
        </div>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="px-5 pt-8 space-y-6 pb-32 max-w-3xl mx-auto flex flex-col justify-start min-h-screen">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-slate-100 rounded-full">
              <ChevronLeft size={24} />
            </button>
            <h1 className="font-display text-2xl tracking-wide">Review Order</h1>
          </div>
          <button
            onClick={handlePrintSO}
            className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
          >
            <Printer size={14} /> Pro-Forma
          </button>
        </div>

        {sections.map((section) => {
          const sectionPacks = section.items.reduce((s, it) => s + it.quantity, 0);
          const remainder = sectionPacks % section.rule.packsPerCarton;
          const neededToFill = section.rule.packsPerCarton - remainder;
          const isIncomplete = remainder > 0;

          return (
            <motion.section
              key={section.cartonType}
              className={`bg-white rounded-[2rem] p-5 border shadow-sm ${isIncomplete ? "border-amber-200" : "border-slate-100"}`}
            >
              <h2 className="font-bold text-slate-800 text-sm mb-4">
                Category {section.cartonType}{" "}
                <span className="text-slate-400 font-medium text-xs">
                  ({section.rule.packsPerCarton} Packs = 1 Carton)
                </span>
              </h2>
              <div className="space-y-4">
                {section.items.map((item) => {
                  const itemTotal = item.quantity * (item.product?.price_per_kg || 0);
                  return (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex-1 pr-4">
                        <p className="font-bold text-sm truncate">{item.product?.name}</p>
                        <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                          Total: <span className="text-slate-800">{formatPrice(itemTotal)}</span>
                        </p>
                      </div>
                      <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-200">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-8 h-8 rounded-lg bg-white shadow-sm font-bold"
                        >
                          {item.quantity === 1 ? <Trash2 size={12} className="text-red-500 mx-auto" /> : "−"}
                        </button>
                        <span className="font-bold text-xs w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-8 h-8 rounded-lg bg-slate-900 text-white shadow-sm font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 mt-5 border-t border-slate-100">
                {isIncomplete ? (
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 shadow-inner">
                    <p className="text-xs font-bold text-amber-900 mb-3 flex items-center gap-1.5">
                      <AlertTriangle size={14} /> Add {neededToFill} more packs to fill carton.
                    </p>
                    <div className="h-1.5 w-full bg-amber-200/50 rounded-full overflow-hidden mb-4">
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${(remainder / section.rule.packsPerCarton) * 100}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {section.items.map((item) => (
                        <button
                          key={`suggest-${item.id}`}
                          onClick={() => handleSmartAdd(item.id, item.quantity, neededToFill)}
                          className="px-3 py-2 bg-white border border-amber-200 text-amber-900 rounded-lg text-[10px] font-bold shadow-sm hover:bg-amber-100 transition-colors flex-1 min-w-[120px]"
                        >
                          + {neededToFill} {item.product?.name.split(" ")[0]}
                        </button>
                      ))}
                      <button
                        onClick={() => handleAutoOptimize(section)}
                        className="w-full mt-1 bg-[#B8860B] text-white py-2.5 rounded-lg text-xs font-bold flex justify-center items-center gap-2 shadow-sm hover:bg-[#9A7009]"
                      >
                        <Wand2 size={14} /> Auto-Fill Mix
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50 rounded-xl p-3 flex justify-center items-center gap-2 border border-emerald-100">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                      All Cartons Filled & Sealed
                    </p>
                  </div>
                )}
              </div>
            </motion.section>
          );
        })}

        <motion.section className="bg-slate-900 text-white rounded-[2rem] shadow-2xl p-6 relative overflow-hidden print:hidden">
          <div className="absolute top-0 right-0 opacity-5 pointer-events-none">
            <Package size={120} className="-mt-4 -mr-4" />
          </div>
          <div className="relative z-10 flex justify-between items-end pb-4 border-b border-white/10">
            <div>
              <span className="text-xs uppercase tracking-widest text-slate-400 font-bold block mb-1">Grand Total</span>
              <span className="text-[10px] text-slate-500">Includes 5% GST</span>
            </div>
            <span className="font-black text-3xl text-[#B8860B]">{formatPrice(grandTotal)}</span>
          </div>
          <button
            onClick={() => setShowPaymentModal(true)}
            disabled={hasIncompleteCartons}
            className="w-full mt-5 py-4 rounded-2xl bg-white text-slate-900 font-bold text-sm hover:bg-slate-100 active:scale-95 disabled:opacity-50 transition-all shadow-xl"
          >
            {hasIncompleteCartons ? "Fill Cartons to Continue" : "Proceed to Checkout"}
          </button>
        </motion.section>
      </div>

      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 print:hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 flex flex-col max-h-[90vh] shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-display text-2xl font-bold text-slate-900">Checkout</h3>
                  <p className="text-sm text-slate-500 mt-1">Select your settlement method.</p>
                </div>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 mb-6 flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-800">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-slate-600 border-b border-slate-200 pb-3">
                  <span>GST (5%)</span>
                  <span className="font-bold text-slate-800">{formatPrice(tax)}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="font-bold text-slate-900 uppercase tracking-wide text-xs">Amount Payable</span>
                  <span className="font-black text-2xl text-[#B8860B]">{formatPrice(grandTotal)}</span>
                </div>
              </div>

              <div className="space-y-3 overflow-y-auto pr-1 pb-4">
                <label
                  className={`flex items-start p-4 border rounded-2xl cursor-pointer transition-all ${paymentMethod === "gateway" ? "border-[#B8860B] bg-[#FFF8DC]" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="gateway"
                    checked={paymentMethod === "gateway"}
                    onChange={() => setPaymentMethod("gateway")}
                    className="hidden"
                  />
                  <div
                    className={`mt-0.5 p-2 rounded-xl flex-shrink-0 ${paymentMethod === "gateway" ? "bg-[#B8860B]/10" : "bg-slate-100"}`}
                  >
                    <CreditCard
                      size={20}
                      className={paymentMethod === "gateway" ? "text-[#B8860B]" : "text-slate-500"}
                    />
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="font-bold text-slate-900 text-sm">Pay Online (Instant)</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Credit/Debit Cards, UPI, Netbanking, Wallets & more.
                    </p>
                  </div>
                </label>
                <label
                  className={`flex items-start p-4 border rounded-2xl cursor-pointer transition-all ${paymentMethod === "utr" ? "border-[#B8860B] bg-[#FFF8DC]" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="utr"
                    checked={paymentMethod === "utr"}
                    onChange={() => setPaymentMethod("utr")}
                    className="hidden"
                  />
                  <div
                    className={`mt-0.5 p-2 rounded-xl flex-shrink-0 ${paymentMethod === "utr" ? "bg-[#B8860B]/10" : "bg-slate-100"}`}
                  >
                    <Banknote size={20} className={paymentMethod === "utr" ? "text-[#B8860B]" : "text-slate-500"} />
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="font-bold text-slate-900 text-sm">Submit Order & Upload Payment Receipt</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      Secure the order now. Transfer via NEFT/RTGS and upload the receipt in your dashboard later.
                    </p>
                  </div>
                </label>
                <label className="flex items-start p-4 border border-slate-100 bg-slate-50 rounded-2xl opacity-60 cursor-not-allowed">
                  <div className="mt-0.5 p-2 rounded-xl flex-shrink-0 bg-slate-200/50">
                    <Lock size={20} className="text-slate-400" />
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="font-bold text-slate-700 text-sm">Corporate Credit Line</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 text-amber-600 font-bold">
                      <AlertTriangle size={12} /> Awaiting Approval
                    </p>
                  </div>
                </label>
              </div>

              <div className="pt-4 mt-auto border-t border-slate-100">
                <button
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting || paymentMethod === "credit"}
                  className="w-full py-4 rounded-xl font-bold text-white bg-slate-900 flex justify-center items-center shadow-lg shadow-slate-900/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : paymentMethod === "gateway" ? (
                    `Pay ${formatPrice(grandTotal)}`
                  ) : (
                    "Finalize Order"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
};

export default Cart;
