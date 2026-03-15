import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { Package, ShoppingCart } from "lucide-react";

interface CartonSection {
  label: string;
  packsPerCarton: number;
  items: { name: string; qty: number; price: string }[];
}

const cartonSections: CartonSection[] = [
  {
    label: "Category A Cartons",
    packsPerCarton: 4,
    items: [
      { name: "Turkish Pistachio Baklawa", qty: 2, price: "₹9,000" },
      { name: "Assorted Premium Box", qty: 1, price: "₹5,200" },
    ],
  },
  {
    label: "Category B Cartons",
    packsPerCarton: 6,
    items: [
      { name: "Cashew Roll Baklawa", qty: 3, price: "₹11,400" },
    ],
  },
  {
    label: "Category C Cartons",
    packsPerCarton: 9,
    items: [
      { name: "Walnut Diamond Cut", qty: 2, price: "₹6,400" },
      { name: "Date & Almond Rolls", qty: 1, price: "₹2,800" },
    ],
  },
];

const Cart = () => {
  const totalCartons = cartonSections.reduce((sum, s) => sum + s.items.reduce((a, b) => a + b.qty, 0), 0);

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

        {/* ── Carton Sections ── */}
        {cartonSections.map((section, si) => (
          <motion.section
            key={si}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: si * 0.1 }}
            className="bg-card rounded-2xl shadow-card p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Package size={18} className="text-primary" />
              <h2 className="font-body font-bold text-foreground text-sm">
                {section.label}
              </h2>
              <span className="font-body text-xs text-muted-foreground">
                ({section.packsPerCarton} Packs/Carton)
              </span>
            </div>

            <div className="space-y-3">
              {section.items.map((item, ii) => (
                <div key={ii} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-semibold text-foreground text-sm">{item.name}</p>
                    <p className="font-body text-xs text-muted-foreground">{item.qty} Carton{item.qty > 1 ? "s" : ""}</p>
                  </div>
                  <p className="font-body font-bold text-foreground text-sm">{item.price}</p>
                </div>
              ))}
            </div>
          </motion.section>
        ))}

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
              <span className="font-semibold text-foreground">₹34,800</span>
            </div>
            <div className="flex justify-between font-body text-sm">
              <span className="text-muted-foreground">Estimated Taxes (18% GST)</span>
              <span className="font-semibold text-foreground">₹6,264</span>
            </div>
            <div className="border-t border-border pt-3 flex justify-between font-body text-base">
              <span className="font-bold text-foreground">Grand Total</span>
              <span className="font-bold text-foreground">₹41,064</span>
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
