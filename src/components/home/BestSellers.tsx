import { Plus } from "lucide-react";
import { motion } from "framer-motion";

import pistachioImg from "@/assets/baklawa-pistachio.jpg";
import cashewImg from "@/assets/baklawa-cashew.jpg";
import walnutImg from "@/assets/baklawa-walnut.jpg";
import assortedImg from "@/assets/baklawa-assorted.jpg";

const products = [
  { name: "Pistachio Baklawa", price: "₹4,500 / kg", image: pistachioImg },
  { name: "Cashew Baklawa", price: "₹3,800 / kg", image: cashewImg },
  { name: "Walnut Baklawa", price: "₹3,200 / kg", image: walnutImg },
  { name: "Assorted Box", price: "₹5,200 / kg", image: assortedImg },
];

const BestSellers = () => {
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
        {products.map((product, i) => (
          <div
            key={i}
            className="min-w-[200px] max-w-[200px] bg-card rounded-2xl shadow-card overflow-hidden flex-shrink-0"
          >
            <div className="w-full h-[180px] overflow-hidden">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-4">
              <p className="font-body font-semibold text-foreground text-sm leading-tight">
                {product.name}
              </p>
              <p className="font-body text-xs text-muted-foreground mt-1.5">
                {product.price}
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
