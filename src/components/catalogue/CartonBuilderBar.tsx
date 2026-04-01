import { useMemo } from "react";
import { useCart } from "@/hooks/useCart";
import { useProducts } from "@/hooks/useProducts";
import { getPacksPerCarton, getProductCategory } from "@/utils/pricing";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CartonGroup {
  cartonType: string;
  filled: number;
  capacity: number;
  percentage: number;
  isFull: boolean;
  remaining: number;
}

const CartonBuilderBar = () => {
  const { items } = useCart();
  const { products } = useProducts();

  const cartonGroups = useMemo(() => {
    if (!items.length || !products.length) return [];

    const groups: Record<string, { filled: number; capacity: number }> = {};

    items.forEach((item) => {
      const product = products.find((p) => p.id === item.product_id);
      if (!product) return;

      const cartonKey = item.carton_type || product.carton_type || "Standard";
      const perCarton = getPacksPerCarton(product);
      if (perCarton <= 0) return;

      if (!groups[cartonKey]) {
        groups[cartonKey] = { filled: 0, capacity: perCarton };
      }
      groups[cartonKey].filled += item.quantity;
    });

    return Object.entries(groups).map(([key, val]): CartonGroup => {
      const filledInCurrent = val.filled % val.capacity;
      const isFull = filledInCurrent === 0 && val.filled > 0;
      return {
        cartonType: key,
        filled: isFull ? val.capacity : filledInCurrent,
        capacity: val.capacity,
        percentage: isFull ? 100 : Math.round((filledInCurrent / val.capacity) * 100),
        isFull,
        remaining: isFull ? 0 : val.capacity - filledInCurrent,
      };
    });
  }, [items, products]);

  if (!cartonGroups.length) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        className="fixed bottom-16 left-0 right-0 z-20 px-4"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div
          className="max-w-md mx-auto bg-card rounded-t-2xl border border-border border-b-0 px-4 py-3 space-y-2"
          style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.06)" }}
        >
          {cartonGroups.slice(0, 2).map((g) => (
            <div key={g.cartonType} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Package size={12} className="text-primary" />
                  <span className="font-body text-xs font-medium text-foreground">
                    {g.cartonType}
                  </span>
                  <span className="font-body text-[10px] text-muted-foreground">
                    · {g.filled}/{g.capacity}
                  </span>
                </div>
                {g.isFull ? (
                  <span className="flex items-center gap-1 text-[10px] font-body text-primary">
                    <CheckCircle2 size={10} /> Full
                  </span>
                ) : (
                  <span className="font-body text-[10px] text-primary">
                    Add {g.remaining} more
                  </span>
                )}
              </div>
              <Progress value={g.percentage} className="h-1.5 bg-muted" />
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CartonBuilderBar;
