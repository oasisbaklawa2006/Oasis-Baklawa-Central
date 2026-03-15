import AppShell from "@/components/AppShell";
import CheckoutModal from "@/components/CheckoutModal";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { Package, ShoppingCart, AlertTriangle, Sparkles, X, CheckCircle2, Info } from "lucide-react";

import pistachioImg from "@/assets/baklawa-pistachio.jpg";
import cashewImg from "@/assets/baklawa-cashew.jpg";
import walnutImg from "@/assets/baklawa-walnut.jpg";

/* ── Starter Sampler Modal ── */
const StarterSamplerModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center px-4 pb-4"
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative bg-card rounded-3xl shadow-card w-full max-w-sm overflow-hidden"
        >
          <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center">
            <X size={16} className="text-foreground" />
          </button>
          <div className="flex h-36 overflow-hidden">
            <img src={pistachioImg} alt="" className="w-1/3 object-cover" />
            <img src={cashewImg} alt="" className="w-1/3 object-cover" />
            <img src={walnutImg} alt="" className="w-1/3 object-cover" />
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              <h2 className="font-display text-lg tracking-wide text-foreground">New to Baklawa? Start Here.</h2>
            </div>
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <p className="font-body font-bold text-foreground text-sm">Oasis Starter Sampler Carton</p>
              <p className="font-body text-xs text-muted-foreground leading-relaxed">
                Perfectly packed for Category C. Includes 3× Pistachio, 3× Cashew, 3× Chocolate Assiyah.
              </p>
              <p className="font-body text-xs text-primary font-semibold">9 Packs · 1 Complete Carton</p>
            </div>
            <button onClick={onClose} className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-body font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-fab">
              <ShoppingCart size={16} />
              Add Starter Kit to Cart
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

/* ── Types ── */
interface CartItem { name: string; packs: number; pricePerPack: number; packSize: string }
interface CartonSection {
  id: string;
  label: string;
  packsPerCarton: number;
  minVariantPacks: number; // minimum packs per variant
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
    minVariantPacks: 3, // STRICT: any variant must be min 3 packs
    items: [
      { name: "Walnut Diamond Cut", packs: 4, pricePerPack: 1600, packSize: "500g" },
      { name: "Date & Almond Rolls", packs: 3, pricePerPack: 933, packSize: "250g" },
    ],
  },
];

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN");

/* ── Smart Fill suggestions for Category C (3-pack rule) ── */
function getSmartFillSuggestions(section: CartonSection): { message: string; action: () => CartonSection }[] {
  const totalPacks = section.items.reduce((s, it) => s + it.packs, 0);
  const remainder = totalPacks % section.packsPerCarton;
  if (remainder === 0) return [];

  const remaining = section.packsPerCarton - remainder;
  const suggestions: { message: string; action: () => CartonSection }[] = [];

  // Check if remaining >= minVariantPacks — can add a new variant
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

  // Suggest adjusting existing items to valid combos
  // For Category C (9 packs, min 3): valid combos are 3+3+3, 6+3, 9
  if (section.minVariantPacks === 3) {
    // Find items that violate the 3-pack minimum or can be adjusted
    const violators = section.items.filter((it) => it.packs < section.minVariantPacks && it.packs > 0);
    if (violators.length === 0) {
      // All items meet minimum but total is wrong — suggest bumping one item
      const adjustableItem = section.items[0];
      if (adjustableItem) {
        const newPacks = adjustableItem.packs + remaining;
        // Ensure the new count is a multiple of 3 or at least meets minimum
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
      // Items below minimum exist — suggest raising them to 3
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
  const [showSampler, setShowSampler] = useState(true);
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
      <StarterSamplerModal open={showSampler} onClose={() => setShowSampler(false)} />

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

          // Check for variant minimum violations
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
                  return (
                    <div key={ii} className={`flex items-center justify-between py-2 border-b last:border-0 ${isViolating ? "border-destructive/30" : "border-border/50"}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-body font-semibold text-foreground text-sm">{item.name}</p>
                        <p className="font-body text-xs text-muted-foreground">
                          {item.packs} × {item.packSize} Pack{item.packs > 1 ? "s" : ""}
                        </p>
                        {isViolating && (
                          <p className="font-body text-[11px] text-destructive font-medium mt-0.5">
                            ⚠ Below {section.minVariantPacks}-pack minimum
                          </p>
                        )}
                      </div>
                      <p className="font-body font-bold text-foreground text-sm">{formatPrice(item.packs * item.pricePerPack)}</p>
                    </div>
                  );
                })}
              </div>

              {/* Smart Fill or Complete */}
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

        {/* ── Order Summary ── */}
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

          {/* Shipping Warning */}
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-muted/60 border border-border/50">
            <Info size={14} className="text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="font-body text-[11px] text-muted-foreground leading-relaxed">
              Orders dispatch only in fully completed master cartons. Incomplete cartons cannot be shipped.
            </p>
          </div>

          <button className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-body font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-fab">
            <ShoppingCart size={18} />
            Proceed to Sales Order
          </button>
        </motion.section>
      </div>
    </AppShell>
  );
};

export default Cart;
