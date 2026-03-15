import AppShell from "@/components/AppShell";
import CheckoutModal from "@/components/CheckoutModal";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { Package, ShoppingCart, AlertTriangle, Sparkles, CheckCircle2, Info } from "lucide-react";

import pistachioImg from "@/assets/baklawa-pistachio.jpg";
import cashewImg from "@/assets/baklawa-cashew.jpg";
import walnutImg from "@/assets/baklawa-walnut.jpg";

/* ── Types ── */
interface CartItem { name: string; packs: number; pricePerPack: number; packSize: string }
interface CartonSection {
  id: string;
  label: string;
  packsPerCarton: number;
  minVariantPacks: number;
  items: CartItem[];
}

const initialSections: CartonSection[] = [
  {
    id: "a",
    label: "Category A Cartons",
    packsPerCarton: 4,
    minVariantPacks: 1,
    items: [{ name: "Turkish Pistachio Baklawa", packs: 4, pricePerPack: 2250, packSize: "1kg" }],
  },
  {
    id: "b",
    label: "Category B Cartons",
    packsPerCarton: 6,
    minVariantPacks: 1,
    items: [{ name: "Cashew Roll Baklawa", packs: 6, pricePerPack: 1900, packSize: "500g" }],
  },
  {
    id: "c",
    label: "Category C Cartons",
    packsPerCarton: 9,
    minVariantPacks: 3,
    items: [
      { name: "Walnut Diamond Cut", packs: 3, pricePerPack: 1600, packSize: "500g" },
      { name: "Date & Almond Rolls", packs: 3, pricePerPack: 933, packSize: "250g" },
      { name: "Chocolate Assiyah", packs: 3, pricePerPack: 1200, packSize: "500g" },
    ],
  },
];

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN");

function getSmartFillSuggestions(section: CartonSection): { message: string; action: () => CartonSection }[] {
  const totalPacks = section.items.reduce((s, it) => s + it.packs, 0);
  const remainder = totalPacks % section.packsPerCarton;
  if (remainder === 0) return [];

  const remaining = section.packsPerCarton - remainder;
  const suggestions: { message: string; action: () => CartonSection }[] = [];

  if (remaining >= section.minVariantPacks) {
    suggestions.push({
      message: `Add ${remaining} × 1kg Packs of Pistachio Baklawa`,
      action: () => {
        const existing = section.items.find((it) => it.name === "Pistachio Baklawa");
        if (existing) {
          return { ...section, items: section.items.map((it) => it.name === "Pistachio Baklawa" ? { ...it, packs: it.packs + remaining } : it) };
        }
        return { ...section, items: [...section.items, { name: "Pistachio Baklawa", packs: remaining, pricePerPack: 2250, packSize: "1kg" }] };
      },
    });
  }

  if (section.minVariantPacks === 3) {
    const violators = section.items.filter((it) => it.packs < section.minVariantPacks && it.packs > 0);
    if (violators.length === 0) {
      const adjustableItem = section.items[0];
      if (adjustableItem) {
        const newPacks = adjustableItem.packs + remaining;
        if (newPacks >= section.minVariantPacks) {
          suggestions.push({
            message: `Change ${adjustableItem.name} from ${adjustableItem.packs} to ${newPacks} packs`,
            action: () => ({
              ...section,
              items: section.items.map((it) =>
                it.name === adjustableItem.name ? { ...it, packs: newPacks } : it
              ),
            }),
          });
        }
      }
    } else {
      for (const v of violators) {
        suggestions.push({
          message: `Increase ${v.name} from ${v.packs} to ${section.minVariantPacks} packs`,
          action: () => ({
            ...section,
            items: section.items.map((it) =>
              it.name === v.name ? { ...it, packs: section.minVariantPacks } : it
            ),
          }),
        });
      }
    }
  }

  return suggestions;
}

const Cart = () => {
  const [showCheckout, setShowCheckout] = useState(false);
  const [sections, setSections] = useState<CartonSection[]>(initialSections);

  const applySuggestion = (sectionId: string, action: () => CartonSection) => {
    setSections((prev) =>
      prev.map((sec) => (sec.id === sectionId ? action() : sec))
    );
  };

  const subtotal = useMemo(
    () => sections.reduce((sum, sec) => sum + sec.items.reduce((s, it) => s + it.packs * it.pricePerPack, 0), 0),
    [sections]
  );
  const tax = Math.round(subtotal * 0.18);
  const totalCartons = sections.reduce((sum, sec) => {
    const packs = sec.items.reduce((s, it) => s + it.packs, 0);
    return sum + Math.floor(packs / sec.packsPerCarton);
  }, 0);

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
          const totalPacks = section.items.reduce((s, it) => s + it.packs, 0);
          const remainder = totalPacks % section.packsPerCarton;
          const isIncomplete = remainder > 0;
          const isComplete = !isIncomplete && totalPacks > 0;
          const suggestions = isIncomplete ? getSmartFillSuggestions(section) : [];
          const hasVariantViolation = section.minVariantPacks > 1 && section.items.some((it) => it.packs > 0 && it.packs < section.minVariantPacks);

          return (
            <motion.section
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: si * 0.1 }}
              className="bg-card rounded-2xl shadow-card p-5 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Package size={18} className="text-primary" />
                <h2 className="font-body font-bold text-foreground text-sm">{section.label}</h2>
                <span className="font-body text-xs text-muted-foreground">({section.packsPerCarton} Packs/Carton)</span>
              </div>

              {section.minVariantPacks > 1 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15">
                  <Info size={12} className="text-primary flex-shrink-0" />
                  <p className="font-body text-[11px] text-primary font-medium">
                    Min. {section.minVariantPacks} packs per variant · Valid combos: 3+3+3, 6+3, or 9
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {section.items.map((item, ii) => {
                  const isViolating = section.minVariantPacks > 1 && item.packs > 0 && item.packs < section.minVariantPacks;

                  const handleIncrement = () => {
                    setSections(prev => prev.map(sec => sec.id !== section.id ? sec : {
                      ...sec,
                      items: sec.items.map((it, idx) => {
                        if (idx !== ii) return it;
                        if (it.packs === 0 && sec.minVariantPacks > 1) return { ...it, packs: sec.minVariantPacks };
                        return { ...it, packs: it.packs + 1 };
                      }),
                    }));
                  };

                  const handleDecrement = () => {
                    setSections(prev => prev.map(sec => sec.id !== section.id ? sec : {
                      ...sec,
                      items: sec.items.map((it, idx) => {
                        if (idx !== ii) return it;
                        if (sec.minVariantPacks > 1 && it.packs <= sec.minVariantPacks) return { ...it, packs: 0 };
                        return { ...it, packs: Math.max(0, it.packs - 1) };
                      }),
                    }));
                  };

                  return (
                    <div key={ii} className={`flex items-center justify-between py-3 border-b last:border-0 ${isViolating ? "border-destructive/30" : "border-border/50"}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-body font-semibold text-foreground text-sm">{item.name}</p>
                        <p className="font-fine text-[11px] text-muted-foreground">
                          {item.packs} × {item.packSize} Pack{item.packs !== 1 ? "s" : ""}
                        </p>
                        {isViolating && (
                          <p className="font-body text-[11px] text-destructive font-medium mt-0.5">
                            ⚠ Below {section.minVariantPacks}-pack minimum
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={handleDecrement} className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center hover:border-primary/50 transition-colors text-foreground text-sm font-bold">−</button>
                        <span className="font-body font-bold text-foreground text-sm w-6 text-center">{item.packs}</span>
                        <button onClick={handleIncrement} className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center hover:border-primary/50 transition-colors text-foreground text-sm font-bold">+</button>
                      </div>
                      <p className="font-body font-bold text-foreground text-sm ml-3 min-w-[70px] text-right">{formatPrice(item.packs * item.pricePerPack)}</p>
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
                        Incomplete Carton: {section.packsPerCarton} packs required. ({totalPacks} selected)
                      </p>
                    </div>
                    {hasVariantViolation && (
                      <p className="font-body text-[11px] text-destructive/80">
                        Each variant must have at least {section.minVariantPacks} packs. Adjust quantities below.
                      </p>
                    )}
                    <div className="flex flex-col gap-2">
                      {suggestions.map((sug, idx) => (
                        <button
                          key={idx}
                          onClick={() => applySuggestion(section.id, sug.action)}
                          className="w-full py-2.5 px-4 rounded-lg bg-card border border-border text-foreground font-body text-xs font-medium hover:border-primary/50 transition-colors flex items-center gap-2"
                        >
                          <Sparkles size={12} className="text-primary" />
                          {sug.message}
                        </button>
                      ))}
                    </div>
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
