import AppShell from "@/components/AppShell";
import CheckoutModal from "@/components/CheckoutModal";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { Package, ShoppingCart, AlertTriangle, Sparkles, CheckCircle2, Info, Loader2, Trash2 } from "lucide-react";
import { useCart, type CartItem } from "@/hooks/useCart";
import { Skeleton } from "@/components/ui/skeleton";

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN");

/* ── Carton rules by carton_type ── */
interface CartonRule {
  packsPerCarton: number;
  minVariantPacks: number;
}

function getCartonRule(cartonType: string | null): CartonRule {
  // Category C = 9 packs/carton, min 3 per variant
  if (cartonType?.toLowerCase().includes("c")) return { packsPerCarton: 9, minVariantPacks: 3 };
  if (cartonType?.toLowerCase().includes("b")) return { packsPerCarton: 6, minVariantPacks: 1 };
  if (cartonType?.toLowerCase().includes("a")) return { packsPerCarton: 4, minVariantPacks: 1 };
  return { packsPerCarton: 1, minVariantPacks: 1 };
}

interface GroupedSection {
  cartonType: string;
  rule: CartonRule;
  items: CartItem[];
}

function groupByCartonType(items: CartItem[]): GroupedSection[] {
  const map = new Map<string, CartItem[]>();
  for (const item of items) {
    const key = item.product?.carton_type ?? item.carton_type ?? "Other";
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
  const { items, loading, updateQuantity, removeItem } = useCart();

  const sections = useMemo(() => groupByCartonType(items), [items]);

  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + it.quantity * (it.product?.price_per_kg ?? 0), 0),
    [items]
  );
  const tax = Math.round(subtotal * 0.18);

  const totalCartons = useMemo(() =>
    sections.reduce((sum, sec) => {
      const packs = sec.items.reduce((s, it) => s + it.quantity, 0);
      return sum + Math.floor(packs / sec.rule.packsPerCarton);
    }, 0),
    [sections]
  );

  if (loading) {
    return (
      <AppShell>
        <div className="px-5 py-6 space-y-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  if (items.length === 0) {
    return (
      <AppShell>
        <div className="px-5 py-6 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <ShoppingCart size={48} className="text-muted-foreground" />
          <h1 className="font-display text-2xl tracking-wide text-foreground">Your Cart is Empty</h1>
          <p className="font-body text-sm text-muted-foreground text-center">Add products from the catalogue to get started.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-2xl md:text-3xl tracking-wide text-foreground"
        >
          Your Cart
        </motion.h1>

        {sections.map((section, si) => {
          const totalPacks = section.items.reduce((s, it) => s + it.quantity, 0);
          const remainder = totalPacks % section.rule.packsPerCarton;
          const isIncomplete = remainder > 0 && section.rule.packsPerCarton > 1;
          const isComplete = !isIncomplete && totalPacks > 0;
          const hasVariantViolation = section.rule.minVariantPacks > 1 &&
            section.items.some((it) => it.quantity > 0 && it.quantity < section.rule.minVariantPacks);

          return (
            <motion.section
              key={section.cartonType}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: si * 0.1 }}
              className="bg-card rounded-2xl shadow-card p-5 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Package size={18} className="text-primary" />
                <h2 className="font-body font-bold text-foreground text-sm">{section.cartonType} Cartons</h2>
                <span className="font-body text-xs text-muted-foreground">({section.rule.packsPerCarton} Packs/Carton)</span>
              </div>

              {section.rule.minVariantPacks > 1 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15">
                  <Info size={12} className="text-primary flex-shrink-0" />
                  <p className="font-body text-[11px] text-primary font-medium">
                    Min. {section.rule.minVariantPacks} packs per variant · Valid combos: 3+3+3, 6+3, or 9
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {section.items.map((item) => {
                  const isViolating = section.rule.minVariantPacks > 1 && item.quantity > 0 && item.quantity < section.rule.minVariantPacks;
                  const product = item.product;
                  const price = product?.price_per_kg ?? 0;

                  return (
                    <div key={item.id} className={`flex items-center justify-between py-3 border-b last:border-0 ${isViolating ? "border-destructive/30" : "border-border/50"}`}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {product?.image_url && (
                          <img src={product.image_url} alt={product.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-body font-semibold text-foreground text-sm">{product?.name ?? "Unknown Product"}</p>
                          <p className="font-fine text-[11px] text-muted-foreground">
                            {item.quantity} × {product?.pack_size ?? item.pack_size ?? "1kg"} Pack{item.quantity !== 1 ? "s" : ""}
                          </p>
                          {isViolating && (
                            <p className="font-body text-[11px] text-destructive font-medium mt-0.5">
                              ⚠ Below {section.rule.minVariantPacks}-pack minimum
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (section.rule.minVariantPacks > 1 && item.quantity <= section.rule.minVariantPacks) {
                              removeItem(item.id);
                            } else {
                              updateQuantity(item.id, item.quantity - 1);
                            }
                          }}
                          className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center hover:border-primary/50 transition-colors text-foreground text-sm font-bold"
                        >−</button>
                        <span className="font-body font-bold text-foreground text-sm w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center hover:border-primary/50 transition-colors text-foreground text-sm font-bold"
                        >+</button>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 size={14} className="text-destructive" />
                        </button>
                      </div>
                      <p className="font-body font-bold text-foreground text-sm ml-3 min-w-[70px] text-right">{formatPrice(item.quantity * price)}</p>
                    </div>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                {isIncomplete ? (
                  <motion.div
                    key="warning"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-xl bg-destructive/5 border border-destructive/15 p-4 space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="text-destructive" />
                      <p className="font-body text-xs text-destructive font-semibold">
                        Incomplete Carton: {section.rule.packsPerCarton} packs required. ({totalPacks} selected)
                      </p>
                    </div>
                    {hasVariantViolation && (
                      <p className="font-body text-[11px] text-destructive/80">
                        Each variant must have at least {section.rule.minVariantPacks} packs. Adjust quantities above.
                      </p>
                    )}
                  </motion.div>
                ) : isComplete ? (
                  <motion.div
                    key="complete"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 py-2"
                  >
                    <CheckCircle2 size={16} className="text-green-600" />
                    <p className="font-body text-xs text-green-600 font-semibold">Carton Complete</p>
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
          className="bg-card rounded-2xl shadow-card p-5 space-y-4"
        >
          <h2 className="font-display text-lg tracking-wide text-foreground">Order Summary</h2>
          <div className="space-y-2.5">
            <div className="flex justify-between font-body text-sm">
              <span className="text-muted-foreground">Total Cartons</span>
              <span className="font-semibold text-foreground">{totalCartons}</span>
            </div>
            <div className="flex justify-between font-body text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold text-foreground">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between font-body text-sm">
              <span className="text-muted-foreground">Estimated Taxes (18% GST)</span>
              <span className="font-semibold text-foreground">{formatPrice(tax)}</span>
            </div>
            <div className="border-t border-border pt-3 flex justify-between font-body text-base">
              <span className="font-bold text-foreground">Grand Total</span>
              <span className="font-bold text-foreground">{formatPrice(subtotal + tax)}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-muted/60 border border-border/50">
            <Info size={14} className="text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="font-body text-[11px] text-muted-foreground leading-relaxed">
              Orders dispatch only in fully completed master cartons. Incomplete cartons cannot be shipped.
            </p>
          </div>

          <button
            onClick={() => setShowCheckout(true)}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-body font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-fab"
          >
            <ShoppingCart size={18} />
            Proceed to Sales Order
          </button>
        </motion.section>
      </div>
      <CheckoutModal open={showCheckout} onClose={() => setShowCheckout(false)} grandTotal={subtotal + tax} />
    </AppShell>
  );
};

export default Cart;
