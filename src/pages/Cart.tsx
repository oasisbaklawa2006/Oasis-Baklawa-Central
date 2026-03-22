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
  Receipt,
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
  const [paymentMethod, setPaymentMethod] = useState("gateway"); // Default to Gateway now

  const { draftOrder, items, updateQuantity, fetchCart } = useCart();
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (a.product?.name || "").localeCompare(b.product?.name || "")),
    [items],
  );
  const sections = useMemo(() => groupByCartonType(sortedItems), [sortedItems]);

  const subtotal = sortedItems.reduce((sum, item) => sum + item.quantity * (item.product?.price_per_kg || 0), 0);
  const tax = Math.round(subtotal * 0.18);
  const grandTotal = subtotal + tax;
  const totalPacks = sortedItems.reduce((s, it) => s + it.quantity, 0);

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
      toast.success(`✨ Carton auto-filled securely!`, { icon: "📦" });
    }
  };

  const handleFinalSubmit = async () => {
    if (!draftOrder) return;
    setIsSubmitting(true);

    // Determine the status flag based on payment method
    let paymentStatusFlag = "pending_verification";
    if (paymentMethod === "credit") paymentStatusFlag = "credit_approved";
    if (paymentMethod === "gateway") paymentStatusFlag = "paid_online"; // In a real app, this waits for Razorpay/Stripe success

    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "submitted",
          sales_order_value: grandTotal,
          payment_status: paymentStatusFlag,
        })
        .eq("id", draftOrder.id);

      if (error) throw error;

      if (paymentMethod === "gateway") {
        toast.success("Payment Successful! Order Sent to Kitchen.");
      } else {
        toast.success("Invoice Logged. Sent to Accounts for clearance.");
      }

      setShowPaymentModal(false);
      setTimeout(() => navigate("/orders"), 1500);
    } catch (error) {
      toast.error("Transaction failed. Please try again.");
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

        {sections.map((section) => {
          const sectionPacks = section.items.reduce((s, it) => s + it.quantity, 0);
          const remainder = sectionPacks % section.rule.packsPerCarton;
          const isIncomplete = remainder > 0;
          return (
            <motion.section
              key={section.cartonType}
              className={`bg-white rounded-[2rem] p-5 border shadow-sm ${isIncomplete ? "border-amber-200" : "border-slate-100"}`}
            >
              <h2 className="font-bold text-slate-800 text-sm mb-4">
                Category {section.cartonType} ({section.rule.packsPerCarton} Packs = 1 Carton)
              </h2>
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

              <div className="pt-4 mt-4 border-t border-slate-100">
                {isIncomplete ? (
                  <div className="bg-amber-50 rounded-xl p-4 space-y-3 border border-amber-200">
                    <p className="text-[11px] font-bold text-amber-800 text-center">
                      Add {section.rule.packsPerCarton - remainder} more packs to seal carton.
                    </p>
                    <div className="h-2 w-full bg-amber-200/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${(remainder / section.rule.packsPerCarton) * 100}%` }}
                      />
                    </div>
                    <button
                      onClick={() => handleAutoOptimize(section)}
                      className="w-full bg-[#B8860B] text-white py-2 rounded-lg text-xs font-bold flex justify-center items-center gap-2"
                    >
                      <Wand2 size={14} /> Auto-Fill
                    </button>
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
            {hasIncompleteCartons ? "Seal Cartons to Continue" : "Proceed to Settlement"}
          </button>
        </motion.section>
      </div>

      {/* THE UPGRADED FINANCIAL SETTLEMENT MODAL */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center p-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 flex flex-col max-h-[90vh]"
            >
              <div className="mb-5">
                <h3 className="font-display text-2xl font-bold text-slate-900">Settle Invoice</h3>
                <p className="text-sm text-slate-500 mt-1">Please select your preferred payment route.</p>
              </div>

              {/* Strict Invoice Breakdown */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 mb-6">
                <div className="flex justify-between text-sm mb-2 text-slate-600">
                  <span>Subtotal ({totalPacks} Packs)</span>
                  <span className="font-bold text-slate-900">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm mb-4 pb-4 border-b border-slate-200 text-slate-600">
                  <span>Estimated GST (18%)</span>
                  <span className="font-bold text-slate-900">{formatPrice(tax)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 uppercase tracking-wide text-xs">Amount Payable</span>
                  <span className="font-black text-2xl text-[#B8860B]">{formatPrice(grandTotal)}</span>
                </div>
              </div>

              {/* Scrollable Payment Options */}
              <div className="space-y-3 overflow-y-auto pr-1 pb-4">
                {/* Option 1: Payment Gateway */}
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
                    className={`mt-0.5 p-2 rounded-xl ${paymentMethod === "gateway" ? "bg-[#B8860B]/10" : "bg-slate-100"}`}
                  >
                    <Smartphone
                      size={20}
                      className={paymentMethod === "gateway" ? "text-[#B8860B]" : "text-slate-500"}
                    />
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="font-bold text-slate-900 text-sm">Pay Online (Instant)</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      UPI, Credit/Debit Card, or Netbanking. Order clears immediately.
                    </p>
                  </div>
                </label>

                {/* Option 2: Bank UTR */}
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
                    className={`mt-0.5 p-2 rounded-xl ${paymentMethod === "utr" ? "bg-[#B8860B]/10" : "bg-slate-100"}`}
                  >
                    <Banknote size={20} className={paymentMethod === "utr" ? "text-[#B8860B]" : "text-slate-500"} />
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="font-bold text-slate-900 text-sm">Upload Bank UTR</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Manual NEFT/RTGS. Order clears after Accounts verification.
                    </p>
                  </div>
                </label>

                {/* Option 3: Credit Line */}
                <label
                  className={`flex items-start p-4 border rounded-2xl cursor-pointer transition-all ${paymentMethod === "credit" ? "border-[#B8860B] bg-[#FFF8DC]" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="credit"
                    checked={paymentMethod === "credit"}
                    onChange={() => setPaymentMethod("credit")}
                    className="hidden"
                  />
                  <div
                    className={`mt-0.5 p-2 rounded-xl ${paymentMethod === "credit" ? "bg-[#B8860B]/10" : "bg-slate-100"}`}
                  >
                    <Receipt size={20} className={paymentMethod === "credit" ? "text-[#B8860B]" : "text-slate-500"} />
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="font-bold text-slate-900 text-sm">Corporate Credit Line</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Bill against ledger. Subject to pre-approved credit limits.
                    </p>
                  </div>
                </label>
              </div>

              {/* Sticky Action Footer */}
              <div className="flex gap-3 pt-4 border-t border-slate-100 mt-auto">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-6 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-4 rounded-xl font-bold text-white bg-slate-900 flex justify-center items-center shadow-lg shadow-slate-900/20 active:scale-95 transition-all"
                >
                  {isSubmitting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : paymentMethod === "gateway" ? (
                    `Pay ${formatPrice(grandTotal)}`
                  ) : paymentMethod === "utr" ? (
                    "Submit for Verification"
                  ) : (
                    "Bill to Ledger"
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
