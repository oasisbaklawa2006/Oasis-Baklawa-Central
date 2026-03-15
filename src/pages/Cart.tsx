import AppShell from "@/components/AppShell";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Package, ShoppingCart, AlertTriangle, Sparkles, X } from "lucide-react";

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

          {/* Hero image strip */}
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

            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-body font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-fab"
            >
              <ShoppingCart size={16} />
              Add Starter Kit to Cart
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

/* ── Cart Data ── */
interface CartItem { name: string; packs: number; price: string }
interface CartonSection {
  label: string;
  packsPerCarton: number;
  items: CartItem[];
}

const cartonSections: CartonSection[] = [
  {
    label: "Category A Cartons",
    packsPerCarton: 4,
    items: [
      { name: "Turkish Pistachio Baklawa", packs: 4, price: "₹9,000" },
    ],
  },
  {
    label: "Category B Cartons",
    packsPerCarton: 6,
    items: [
      { name: "Cashew Roll Baklawa", packs: 6, price: "₹11,400" },
    ],
  },
  {
    label: "Category C Cartons",
    packsPerCarton: 9,
    items: [
      { name: "Walnut Diamond Cut", packs: 4, price: "₹6,400" },
      { name: "Date & Almond Rolls", packs: 3, price: "₹2,800" },
    ],
  },
];

const Cart = () => {
  const [showSampler, setShowSampler] = useState(true);

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

        {cartonSections.map((section, si) => {
          const totalPacks = section.items.reduce((s, it) => s + it.packs, 0);
          const remaining = section.packsPerCarton - (totalPacks % section.packsPerCarton);
          const isIncomplete = remaining > 0 && remaining < section.packsPerCarton;

          return (
            <motion.section
              key={si}
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
                    <p className="font-body font-bold text-foreground text-sm">{item.price}</p>
                  </div>
                ))}
              </div>

              {/* Smart Fill Warning */}
              {isIncomplete && (
                <div className="rounded-xl bg-destructive/5 border border-destructive/15 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-destructive" />
                    <p className="font-body text-xs text-destructive font-semibold">
                      Incomplete Carton: {section.packsPerCarton} packs required. ({totalPacks} selected)
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button className="w-full py-2.5 px-4 rounded-lg bg-card border border-border text-foreground font-body text-xs font-medium hover:border-primary/50 transition-colors flex items-center gap-2">
                      <Sparkles size={12} className="text-primary" />
                      Add {remaining} pack{remaining > 1 ? "s" : ""} of Pistachio Baklawa
                    </button>
                    <button className="w-full py-2.5 px-4 rounded-lg bg-card border border-border text-foreground font-body text-xs font-medium hover:border-primary/50 transition-colors flex items-center gap-2">
                      <Sparkles size={12} className="text-primary" />
                      Fill remaining space with Best Seller
                    </button>
                  </div>
                </div>
              )}
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
              <span className="font-semibold text-foreground">3</span>
            </div>
            <div className="flex justify-between font-body text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold text-foreground">₹29,600</span>
            </div>
            <div className="flex justify-between font-body text-sm">
              <span className="text-muted-foreground">Estimated Taxes (18% GST)</span>
              <span className="font-semibold text-foreground">₹5,328</span>
            </div>
            <div className="border-t border-border pt-3 flex justify-between font-body text-base">
              <span className="font-bold text-foreground">Grand Total</span>
              <span className="font-bold text-foreground">₹34,928</span>
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
