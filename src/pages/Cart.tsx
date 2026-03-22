import AppShell from "@/components/AppShell";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { Package, ShoppingCart, AlertTriangle, CheckCircle2, Trash2, Loader2, Wand2 } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN");

interface CartonRule {
  packsPerCarton: number;
}

function getCartonRule(cartonType: string | null): CartonRule {
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
  const [isOptimizing, setIsOptimizing] = useState(false);

  const { draftOrder, items, updateQuantity, fetchCart } = useCart();

  // BUG FIX 1: Sort items alphabetically by name so they never shape-shift!
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => (a.product?.name || "").localeCompare(b.product?.name || ""));
  }, [items]);

  const sections = useMemo(() => groupByCartonType(sortedItems), [sortedItems]);

  const subtotal = sortedItems.reduce((sum, item) => sum + item.quantity * (item.product?.price_per_kg || 0), 0);
  const tax = Math.round(subtotal * 0.18);
  const grandTotal = subtotal + tax;
  const totalPacks = sortedItems.reduce((s, it) => s + it.quantity, 0);

  // BUG FIX 2: Check if ANY section has an incomplete carton
  const hasIncompleteCartons = sections.some((section) => {
    const packs = section.items.reduce((s, it) => s + it.quantity, 0);
    return packs > 0 && packs % section.rule.packsPerCarton !== 0;
  });

  const handleAutoOptimize = async (section: any) => {
    setIsOptimizing(true);
    const sectionPacks = section.items.reduce((s: number, it: any) => s + it.quantity, 0);
    const remainder = sectionPacks % section.rule.packsPerCarton;

    if (remainder > 0) {
      const neededToFill = section.rule.packsPerCarton - remainder;
      const targetItem = [...section.items].sort((a, b) => b.quantity - a.quantity)[0];
      await updateQuantity(targetItem.id, targetItem.quantity + neededToFill);
      await fetchCart();
      toast.success(`✨ Carton auto-filled securely!`, { icon: "📦" });
    }
    setIsOptimizing(false);
  };

  const handleCheckout = async () => {
    if (!draftOrder || sortedItems.length === 0 || hasIncompleteCartons) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "submitted",
          sales_order_value: grandTotal,
        })
        .eq("id", draftOrder.id);

      if (error) throw error;

      toast.success("Batch Successfully Sent to Accounts!");
      setTimeout(() => navigate("/orders"), 2000);
    } catch (error) {
      toast.error("Failed to submit batch.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sortedItems.length === 0) {
    return (
      <AppShell>
        <div className="px-5 py-6 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <ShoppingCart size={48} className="text-muted-foreground/30" />
          <h1 className="font-display text-2xl tracking-wide text-foreground">Your Batch is Empty</h1>
          {/* BUG FIX 3: Corrected the route from /catalog to /catalogue */}
          <button onClick={() => navigate("/catalogue")} className="text-primary font-bold hover:underline">
            Browse Catalogue
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6 pb-24 max-w-3xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-2xl md:text-3xl tracking-wide text-foreground"
        >
          Review Batch
        </motion.h1>

        {sections.map((section, si) => {
          const sectionPacks = section.items.reduce((s, it) => s + it.quantity, 0);
          const sectionCartons = Math.floor(sectionPacks / section.rule.packsPerCarton);
          const remainder = sectionPacks % section.rule.packsPerCarton;
          const isIncomplete = remainder > 0;
          const neededToFill = section.rule.packsPerCarton - remainder;

          return (
            <motion.section
              key={section.cartonType}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: si * 0.1 }}
              className={`bg-white rounded-[2rem] p-5 space-y-4 border shadow-sm ${isIncomplete ? "border-amber-200" : "border-slate-100"}`}
            >
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Package size={18} className={isIncomplete ? "text-amber-500" : "text-emerald-500"} />
                <h2 className="font-bold text-slate-800 text-sm tracking-wide">Category {section.cartonType}</h2>
                <span className="text-[10px] text-slate-500 ml-auto bg-slate-100 px-2 py-1 rounded-full font-bold">
                  {section.rule.packsPerCarton} PACKS = 1 CARTON
                </span>
              </div>

              <div className="space-y-3">
                {section.items.map((item) => {
                  const product = item.product;
                  const price = product?.price_per_kg ?? 0;

                  return (
                    <div key={item.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 p-1">
                          {product?.image_url ? (
                            <img src={product.image_url} className="w-full h-full object-contain" />
                          ) : (
                            <Package size={16} className="text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate">{product?.name}</p>
                          <p className="text-[10px] text-slate-500 font-bold mt-0.5">₹{price} / pack</p>
                        </div>
                      </div>
                      <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-200">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-8 h-8 rounded-lg bg-white text-slate-800 flex items-center justify-center hover:bg-slate-100 shadow-sm font-bold"
                        >
                          {item.quantity === 1 ? <Trash2 size={12} className="text-red-500" /> : "−"}
                        </button>
                        <span className="font-bold text-slate-900 text-xs w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center hover:bg-black shadow-sm font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* SECTION PROGRESS BAR & AUTO-OPTIMIZE */}
              <div className="pt-2 border-t border-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-slate-500">Carton Status</p>
                  <p className="text-xs font-bold text-slate-800">{sectionCartons} Sealed Cartons</p>
                </div>

                <AnimatePresence mode="wait">
                  {isIncomplete ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                        <div className="h-1.5 w-full bg-amber-200/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500"
                            style={{ width: `${(remainder / section.rule.packsPerCarton) * 100}%` }}
                          />
                        </div>
                        <p className="text-[11px] font-bold text-amber-800 text-center">
                          <AlertTriangle size={12} className="inline mr-1 -mt-0.5" />
                          Add {neededToFill} more packs to seal the next carton.
                        </p>

                        {/* BUG FIX 4: Put the Auto-Optimize button right inside the warning! */}
                        <button
                          onClick={() => handleAutoOptimize(section)}
                          disabled={isOptimizing}
                          className="w-full bg-[#B8860B] hover:bg-[#9A7009] text-white py-2.5 rounded-lg text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                          {isOptimizing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                          Auto-Fill Carton
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                          All Cartons Perfectly Sealed
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.section>
          );
        })}

        {/* Financial Summary */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-900 text-white rounded-[2rem] shadow-2xl p-6 space-y-4"
        >
          <h2 className="text-sm uppercase tracking-widest text-slate-400 font-bold mb-4">Financial Summary</h2>
          <div className="space-y-2 pb-4 border-b border-white/10 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-300">Total Packs</span>
              <span className="font-bold">{totalPacks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">Subtotal</span>
              <span className="font-bold">{formatPrice(subtotal)}</span>
            </div>
          </div>
          <div className="flex justify-between items-end pt-2">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
              Grand Total (Inc. Tax)
            </span>
            <span className="font-bold text-2xl text-[#B8860B]">{formatPrice(grandTotal)}</span>
          </div>

          {/* BUG FIX 5: Hard-locked checkout button. Cannot proceed if incomplete. */}
          <button
            onClick={handleCheckout}
            disabled={isSubmitting || hasIncompleteCartons}
            className="w-full mt-4 py-4 rounded-2xl bg-white text-slate-900 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-100 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isSubmitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : hasIncompleteCartons ? (
              "Seal Cartons to Continue"
            ) : (
              "Confirm & Send to Accounts"
            )}
          </button>
        </motion.section>
      </div>
    </AppShell>
  );
};

export default Cart;
