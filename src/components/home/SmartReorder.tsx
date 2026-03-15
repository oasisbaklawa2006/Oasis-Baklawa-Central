import { RotateCcw } from "lucide-react";
import { motion } from "framer-motion";

const reorderItems = [
  { name: "Pistachio Baklawa", qty: "9 Cartons", price: "₹4,500" },
  { name: "Cashew Baklawa", qty: "9 Cartons", price: "₹3,800" },
  { name: "Walnut Baklawa", qty: "6 Cartons", price: "₹3,200" },
];

const SmartReorder = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="bg-card rounded-2xl shadow-card p-8"
    >
      <h2 className="font-display text-xl md:text-2xl tracking-wide text-foreground mb-1">
        Smart Reorder
      </h2>
      <p className="text-sm font-body text-muted-foreground mb-6">
        Based on your frequent orders
      </p>

      <div className="space-y-4 mb-8">
        {reorderItems.map((item, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-3 border-b border-border last:border-0"
          >
            <div>
              <p className="font-body font-semibold text-foreground text-sm">{item.name}</p>
              <p className="font-body text-xs text-muted-foreground mt-0.5">{item.qty}</p>
            </div>
            <p className="font-body font-semibold text-foreground text-sm">{item.price}</p>
          </div>
        ))}
      </div>

      <button className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-body font-semibold text-sm tracking-wide flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
        <RotateCcw size={16} />
        1-Tap Reorder
      </button>
    </motion.div>
  );
};

export default SmartReorder;
