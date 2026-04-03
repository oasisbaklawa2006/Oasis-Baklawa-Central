import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { X, Minus, Plus, ShoppingCart, Pencil, Sparkles } from "lucide-react";

interface AIItem {
  name: string;
  qty: number;
  unit: string;
  packSize: string;
}

const initialItems: AIItem[] = [
  { name: "Pistachio Baklawa", qty: 10, unit: "Cartons", packSize: "1kg" },
  { name: "Cashew Roll Baklawa", qty: 5, unit: "Cartons", packSize: "500g" },
  { name: "Assorted Premium Box", qty: 8, unit: "Cartons", packSize: "1kg" },
];

const AIOrderReview = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [items, setItems] = useState<AIItem[]>(initialItems);

  const updateQty = (index: number, delta: number) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === index ? { ...it, qty: Math.max(1, it.qty + delta) } : it
      )
    );
  };

  return (
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
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative bg-card rounded-3xl shadow-card w-full max-w-md overflow-hidden"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center"
            >
              <X size={16} className="text-foreground" />
            </button>

            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-primary" />
                  <h2 className="font-display text-lg tracking-wide text-foreground">Verify Your Order</h2>
                </div>
                <p className="font-body text-xs text-muted-foreground leading-relaxed">
                  Here is what our AI understood from your upload. Please review before adding to cart.
                </p>
              </div>

              {/* Item List */}
              <div className="space-y-3">
                {items.map((item, i) => (
                  <div
                    key={`${item.name}-${i}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-body font-semibold text-foreground text-sm">{item.name}</p>
                      <p className="font-body text-[11px] text-muted-foreground">
                        {item.unit} · {item.packSize} Packs
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(i, -1)}
                        className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center hover:border-primary/50 transition-colors"
                      >
                        <Minus size={14} className="text-foreground" />
                      </button>
                      <span className="font-body font-bold text-foreground text-sm w-8 text-center">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateQty(i, 1)}
                        className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center hover:border-primary/50 transition-colors"
                      >
                        <Plus size={14} className="text-foreground" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl border border-border font-body font-semibold text-sm text-foreground flex items-center justify-center gap-2 hover:bg-muted/50 transition-colors"
                >
                  <Pencil size={14} />
                  Edit Manually
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-body font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-fab"
                >
                  <ShoppingCart size={14} />
                  Confirm & Add
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AIOrderReview;
