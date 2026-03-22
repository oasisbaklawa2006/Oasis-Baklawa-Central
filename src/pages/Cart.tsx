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
} from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN");

// Same helper functions...
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

  const { draftOrder, items, updateQuantity, fetchCart } = useCart();
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (a.product?.name || "").localeCompare(b.product?.name || "")),
    [items],
  );
  const sections = useMemo(() => groupByCartonType(sortedItems), [sortedItems]);

  const subtotal = sortedItems.reduce((sum, item) => sum + item.quantity * (item.product?.price_per_kg || 0), 0);
  const grandTotal = subtotal + Math.round(subtotal * 0.18);

  const hasIncompleteCartons = sections.some((section) => {
    const packs = section.items.reduce((s, it) => s + it.quantity, 0);
    return packs > 0 && packs % section.rule.packsPerCarton !== 0;
  });

  const handleFinalSubmit = async () => {
    if (!draftOrder) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "submitted",
          sales_order_value: grandTotal,
          payment_status: paymentMethod === "utr" ? "pending_verification" : "credit",
        })
        .eq("id", draftOrder.id);

      if (error) throw error;
      toast.success("Order & Payment Sent to Accounts!");
      setShowPaymentModal(false);
      setTimeout(() => navigate("/orders"), 1500);
    } catch (error) {
      toast.error("Failed to submit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sortedItems.length === 0)
    return (
      <AppShell>
        <div className="px-5 py-6 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <ShoppingCart size={48} className="text-slate-300" />
          <h1 className="font-display text-2xl tracking-wide">Your Batch is Empty</h1>
          <button onClick={() => navigate("/catalogue")} className="text-[#B8860B] font-bold">
            Browse Catalogue
          </button>
        </div>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6 pb-32 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-slate-100 rounded-full">
            <ChevronLeft size={24} />
          </button>
          <h1 className="font-display text-2xl tracking-wide">Review Batch</h1>
        </div>

        {/* Sections loop remains identical to handle Gamified Carton Fillers */}
        {sections.map((section, si) => {
          const sectionPacks = section.items.reduce((s, it) => s + it.quantity, 0);
          const remainder = sectionPacks % section.rule.packsPerCarton;
          const isIncomplete = remainder > 0;
          return (
            <motion.section
              key={section.cartonType}
              className={`bg-white rounded-[2rem] p-5 border shadow-sm ${isIncomplete ? "border-amber-200" : "border-slate-100"}`}
            >
              {/* Same items mapping as before... */}
              <h2 className="font-bold text-slate-800 text-sm mb-4">Category {section.cartonType}</h2>
              <div className="space-y-3">
                {section.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2">
                    <p className="font-bold text-sm truncate">{item.product?.name}</p>
                    <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-200">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-8 h-8 rounded-lg bg-white shadow-sm font-bold"
                      >
                        {item.quantity === 1 ? <Trash2 size={12} className="text-red-500 mx-auto" /> : "−"}
                      </button>
                      <span className="font-bold text-xs w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-8 h-8 rounded-lg bg-slate-900 text-white shadow-sm font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* CARTON FILLER WIDGET */}
              <div className="pt-4 mt-4 border-t border-slate-100">
                {isIncomplete ? (
                  <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                    <p className="text-[11px] font-bold text-amber-800 text-center mb-2">
                      Incomplete Carton: Add {section.rule.packsPerCarton - remainder} more packs to seal.
                    </p>
                    <div className="h-2 w-full bg-amber-200/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${(remainder / section.rule.packsPerCarton) * 100}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <p className="text-[11px] font-bold text-emerald-800">✨ All Cartons Sealed</p>
                  </div>
                )}
              </div>
            </motion.section>
          );
        })}

        <motion.section className="bg-slate-900 text-white rounded-[2rem] shadow-2xl p-6">
          <div className="flex justify-between items-end pb-4 border-b border-white/10">
            <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">Grand Total</span>
            <span className="font-bold text-2xl text-[#B8860B]">{formatPrice(grandTotal)}</span>
          </div>
          <button
            onClick={() => setShowPaymentModal(true)}
            disabled={hasIncompleteCartons}
            className="w-full mt-4 py-4 rounded-2xl bg-white text-slate-900 font-bold text-sm hover:bg-slate-100 active:scale-95 disabled:opacity-50"
          >
            {hasIncompleteCartons ? "Seal Cartons to Continue" : "Proceed to Payment"}
          </button>
        </motion.section>
      </div>

      {/* THE NEW PAYMENT MODAL */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center p-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 space-y-6"
            >
              <div>
                <h3 className="font-display text-xl font-bold text-slate-900">Payment Details</h3>
                <p className="text-sm text-slate-500 mt-1">Select how you will settle this invoice.</p>
              </div>

              <div className="space-y-3">
                <label
                  className={`flex items-center p-4 border rounded-2xl cursor-pointer transition-all ${paymentMethod === "utr" ? "border-[#B8860B] bg-[#FFF8DC]" : "border-slate-200"}`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="utr"
                    checked={paymentMethod === "utr"}
                    onChange={() => setPaymentMethod("utr")}
                    className="hidden"
                  />
                  <Banknote size={24} className={paymentMethod === "utr" ? "text-[#B8860B]" : "text-slate-400"} />
                  <div className="ml-4">
                    <p className="font-bold text-slate-900 text-sm">Upload Bank UTR</p>
                    <p className="text-xs text-slate-500">I will transfer and upload receipt.</p>
                  </div>
                </label>

                <label
                  className={`flex items-center p-4 border rounded-2xl cursor-pointer transition-all ${paymentMethod === "credit" ? "border-[#B8860B] bg-[#FFF8DC]" : "border-slate-200"}`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="credit"
                    checked={paymentMethod === "credit"}
                    onChange={() => setPaymentMethod("credit")}
                    className="hidden"
                  />
                  <CreditCard size={24} className={paymentMethod === "credit" ? "text-[#B8860B]" : "text-slate-400"} />
                  <div className="ml-4">
                    <p className="font-bold text-slate-900 text-sm">Approved Credit Line</p>
                    <p className="text-xs text-slate-500">Bill against my company ledger.</p>
                  </div>
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-3.5 rounded-xl font-bold text-slate-600 bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 rounded-xl font-bold text-white bg-slate-900 flex justify-center items-center"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Confirm Order"}
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
