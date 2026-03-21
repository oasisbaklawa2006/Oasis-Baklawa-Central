import AppShell from "@/components/AppShell";
import CheckoutModal from "@/components/CheckoutModal";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { Package, ShoppingCart, AlertTriangle, CheckCircle2, Info, Trash2, Loader2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext.tsx";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN");

const PACKS_PER_CARTON = 9;

/* ── Carton rules by carton_type ── */
interface CartonRule {
  packsPerCarton: number;
  minVariantPacks: number;
}

function getCartonRule(cartonType: string | null): CartonRule {
  if (cartonType?.toLowerCase().includes("c")) return { packsPerCarton: 9, minVariantPacks: 3 };
  if (cartonType?.toLowerCase().includes("b")) return { packsPerCarton: 6, minVariantPacks: 1 };
  if (cartonType?.toLowerCase().includes("a")) return { packsPerCarton: 4, minVariantPacks: 1 };
  return { packsPerCarton: 9, minVariantPacks: 1 };
}

interface GroupedSection {
  cartonType: string;
  rule: CartonRule;
  items: any[];
}

function groupByCartonType(items: any[]): GroupedSection[] {
  const map = new Map<string, any[]>();
  for (const item of items) {
    const key = item.product?.carton_type ?? "Other";
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
  const [showCheckout, setShowCheckout] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { cart, updateQuantity, clearCart, totalValue } = useCart();
  const items = Object.values(cart);

  const sections = useMemo(() => groupByCartonType(items), [items]);
  const subtotal = totalValue;
  const tax = Math.round(subtotal * 0.18);
  const grandTotal = subtotal + tax;

  const totalPacks = useMemo(() => items.reduce((s, it) => s + it.quantity, 0), [items]);
  const totalCartons = Math.floor(totalPacks / PACKS_PER_CARTON);

  // The Bulletproof Checkout Logic
  const handleCheckout = async () => {
    if (items.length === 0) return;
    setIsSubmitting(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      let companyId = null;

      if (user) {
        const { data: appUser } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
        if (appUser && "company_id" in appUser) companyId = String((appUser as any).company_id);
      }

      // 1. Create Order
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert([{ status: "submitted", sales_order_value: grandTotal, company_id: companyId }])
        .select("id")
        .single();

      if (orderError) throw orderError;

      // 2. Insert Items (Removed price_at_time_of_order to bypass the database blocker)
      const orderItems = items.map((item) => ({
        order_id: orderData.id,
        product_id: item.product.id,
        quantity: item.quantity,
        pack_size: item.product.pack_size,
        carton_type: item.product.carton_type,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      // 3. Success!
      clearCart();
      toast.success("Order Successfully Sent to Kitchen!");
      setTimeout(() => (window.location.href = "/orders"), 2000);
    } catch (error) {
      console.error(error);
      toast.error("Failed to place order. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <AppShell>
        <div className="px-5 py-6 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <ShoppingCart size={48} className="text-muted-foreground/30" />
          <h1 className="font-display text-2xl tracking-wide text-foreground">Your Cart is Empty</h1>
          <p className="font-body text-sm text-muted-foreground text-center">
            Add products from the catalogue to get started.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6 pb-24">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-2xl md:text-3xl tracking-wide text-foreground"
        >
          Your Batch
        </motion.h1>

        {sections.map((section, si) => {
          const sectionPacks = section.items.reduce((s, it) => s + it.quantity, 0);
          const sectionCartons = Math.floor(sectionPacks / section.rule.packsPerCarton);
          const remainder = sectionPacks % section.rule.packsPerCarton;
          const isIncomplete = remainder > 0 && section.rule.packsPerCarton > 1;
          const isComplete = !isIncomplete && sectionPacks > 0;

          return (
            <motion.section
              key={section.cartonType}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: si * 0.1 }}
              className={`bg-card rounded-[2rem] p-5 space-y-4 border ${isIncomplete ? "border-amber-200/50 shadow-md" : "border-border shadow-card"}`}
            >
              <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                <Package size={18} className="text-primary" />
                <h2 className="font-body font-bold text-foreground text-sm uppercase tracking-wider">
                  {section.cartonType || "Standard"} Cartons
                </h2>
                <span className="font-fine text-[10px] text-muted-foreground ml-auto bg-muted px-2 py-1 rounded-full font-bold">
                  {section.rule.packsPerCarton} PACKS = 1 CARTON
                </span>
              </div>

              <div className="space-y-3">
                {section.items.map((item) => {
                  const product = item.product;
                  const price = product?.price_per_kg ?? 0;

                  return (
                    <div key={item.product.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {product?.image_url ? (
                          <img
                            src={product.image_url}
                            className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-border"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
                            <Package size={16} className="text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-body font-bold text-foreground text-sm truncate">{product?.name}</p>
                          <p className="font-fine text-[10px] text-primary font-bold mt-0.5">₹{price} / pack</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-muted/50 rounded-xl p-1 border border-border/50">
                          <button
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="w-7 h-7 rounded-lg bg-card text-foreground flex items-center justify-center hover:bg-muted transition-colors shadow-sm font-bold text-sm"
                          >
                            {item.quantity === 1 ? <Trash2 size={12} className="text-destructive" /> : "−"}
                          </button>
                          <span className="font-ui font-bold text-foreground text-xs w-6 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors shadow-sm font-bold text-sm"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                {isIncomplete ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 mt-4 flex items-start gap-3">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                      <div>
                        <p className="font-bold text-amber-900 text-[11px] uppercase tracking-wider">
                          Incomplete Carton
                        </p>
                        <p className="text-amber-700 text-[11px] mt-0.5">
                          You need <strong>{section.rule.packsPerCarton - remainder}</strong> more pack(s) to seal this
                          master carton for dispatch.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ) : isComplete ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 py-2 mt-2 bg-emerald-50 rounded-xl px-3 border border-emerald-100"
                  >
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <p className="font-body text-[11px] text-emerald-700 font-bold uppercase tracking-wider">
                      Cartons Sealed & Ready
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.section>
          );
        })}

        {/* Order Summary */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-900 text-white rounded-[2rem] shadow-2xl p-6 space-y-4"
        >
          <h2 className="font-display text-sm uppercase tracking-widest text-slate-400 font-bold mb-6">
            Financial Summary
          </h2>

          <div className="space-y-3 pb-4 border-b border-white/10">
            <div className="flex justify-between font-ui text-sm">
              <span className="text-slate-300">Total Packs</span>
              <span className="font-bold">{totalPacks}</span>
            </div>
            <div className="flex justify-between font-ui text-sm">
              <span className="text-slate-300">Total Master Cartons</span>
              <span className="font-bold">{totalCartons}</span>
            </div>
            <div className="flex justify-between font-ui text-sm">
              <span className="text-slate-300">Subtotal</span>
              <span className="font-bold">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between font-ui text-sm">
              <span className="text-slate-300">Estimated Taxes (18% GST)</span>
              <span className="font-bold text-slate-400">{formatPrice(tax)}</span>
            </div>
          </div>

          <div className="flex justify-between font-ui items-end pt-2">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Grand Total</span>
            <span className="font-bold text-2xl text-primary">{formatPrice(grandTotal)}</span>
          </div>

          <button
            onClick={handleCheckout}
            disabled={
              isSubmitting ||
              sections.some((section) => {
                const packs = section.items.reduce((s, it) => s + it.quantity, 0);
                return packs > 0 && packs % section.rule.packsPerCarton !== 0 && section.rule.packsPerCarton > 1;
              })
            }
            className="w-full mt-4 py-4 rounded-2xl bg-primary text-primary-foreground font-ui font-bold text-sm flex items-center justify-center gap-2 hover:bg-white hover:text-slate-900 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Confirm & Send to Kitchen"}
          </button>
        </motion.section>
      </div>
    </AppShell>
  );
};

export default Cart;
