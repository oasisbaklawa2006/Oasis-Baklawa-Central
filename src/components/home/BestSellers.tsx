import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useProducts } from "@/hooks/useProducts";
import { Skeleton } from "@/components/ui/skeleton";

const formatPrice = (price: number) =>
  `₹${price.toLocaleString("en-IN")} / kg`;

const BestSellers = () => {
  const navigate = useNavigate();
  const { products, loading } = useProducts();

  // Show first 4 products as "best sellers"
  const bestSellers = products.slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <h2 className="font-display text-xl md:text-2xl tracking-wide text-foreground mb-5 px-1">
        Best Sellers
      </h2>

      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1">
        {loading
          ? [1, 2, 3, 4].map((i) => (
              <div key={i} className="min-w-[200px] max-w-[200px] bg-card rounded-2xl shadow-card overflow-hidden flex-shrink-0">
                <Skeleton className="w-full h-[180px]" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-8 w-full mt-2" />
                </div>
              </div>
            ))
          : bestSellers.map((product) => (
              <div
                key={product.id}
                onClick={() => navigate(`/product/${product.id}`)}
                className="min-w-[200px] max-w-[200px] bg-card rounded-2xl shadow-card overflow-hidden flex-shrink-0 cursor-pointer"
              >
                <div className="w-full h-[180px] overflow-hidden bg-muted">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground font-body text-xs">No Image</div>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-body font-semibold text-foreground text-sm leading-tight">
                    {product.name}
                  </p>
                  <p className="font-fine text-[11px] text-muted-foreground mt-1.5">
                    {formatPrice(product.price_per_kg)}
                  </p>
                  <button className="mt-3 w-full py-2 rounded-lg bg-primary/10 text-primary font-body font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-primary hover:text-primary-foreground transition-colors">
                    <Plus size={14} />
                    Add
                  </button>
                </div>
              </div>
            ))}
      </div>
    </motion.div>
  );
};

export default BestSellers;
