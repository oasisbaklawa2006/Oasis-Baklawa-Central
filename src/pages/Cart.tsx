import AppShell from "@/components/AppShell";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { Package, ShoppingCart, AlertTriangle, Sparkles, X, CheckCircle2 } from "lucide-react";

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
interface CartItem { name: string; packs: number; pricePerPack: number }
interface CartonSection {
  id: string;
  label: string;
  packsPerCarton: number;
  items: CartItem[];
}

const initialSections: CartonSection[] = [
  {
    id: "a",
    label: "Category A Cartons",
    packsPerCarton: 4,
    items: [{ name: "Turkish Pistachio Baklawa", packs: 4, pricePerPack: 2250 }],
  },
  {
    id: "b",
    label: "Category B Cartons",
    packsPerCarton: 6,
    items: [{ name: "Cashew Roll Baklawa", packs: 6, pricePerPack: 1900 }],
  },
  {
    id: "c",
    label: "Category C Cartons",
    packsPerCarton: 9,
    items: [
      { name: "Walnut Diamond Cut", packs: 4, pricePerPack: 1600 },
      { name: "Date & Almond Rolls", packs: 3, pricePerPack: 933 },
    ],
  },
];

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN");

const Cart = () => {
  const [showSampler, setShowSampler] = useState(true);
  const [sections, setSections] = useState<CartonSection[]>(initialSections);

  const smartFill = (sectionId: string, fillType: "pistachio" | "bestseller") => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        const totalPacks = sec.items.reduce((s, it) => s + it.packs, 0);
        const remaining = sec.packsPerCarton - (totalPacks % sec.packsPerCarton);
        if (remaining === 0 || remaining === sec.packsPerCarton) return sec;

        const fillName = fillType === "pistachio" ? "Pistachio Baklawa" : "Assorted Best Seller";
        const fillPrice = fillType === "pistachio" ? 2250 : 2000;

        const existing = sec.items.find((it) => it.name === fillName);
        if (existing) {
          return {
            ...sec,
            items: sec.items.map((it) =>
              it.name === fillName ? { ...it, packs: it.packs + remaining } : it
            ),
          };
        }
        return {
          ...sec,
          items: [...sec.items, { name: fillName, packs: remaining, pricePerPack: fillPrice }],
        };
      })
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
          const remaining = section.packsPerCarton - remainder;
          const isComplete = !isIncomplete && totalPacks > 0;

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

              <div className="space-y-3">
                {section.items.map((item, ii) => (
                  <div key={ii} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-body font-semibold text-foreground text-sm">{item.name}</p>
                      <p className="font-body text-xs text-muted-foreground">{item.packs} Pack{item.packs > 1 ? "s" : ""}</p>
                    </div>
                    <p className="font-body font-bold text-foreground text-sm">{formatPrice(item.packs * item.pricePerPack)}</p>
                  </div>
                ))}
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
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => smartFill(section.id, "pistachio")}
                        className="w-full py-2.5 px-4 rounded-lg bg-card border border-border text-foreground font-body text-xs font-medium hover:border-primary/50 transition-colors flex items-center gap-2"
                      >
                        <Sparkles size={12} className="text-primary" />
                        Add {remaining} pack{remaining > 1 ? "s" : ""} of Pistachio Baklawa
                      </button>
                      <button
                        onClick={() => smartFill(section.id, "bestseller")}
                        className="w-full py-2.5 px-4 rounded-lg bg-card border border-border text-foreground font-body text-xs font-medium hover:border-primary/50 transition-colors flex items-center gap-2"
                      >
                        <Sparkles size={12} className="text-primary" />
                        Fill remaining space with Best Seller
                      </button>
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
