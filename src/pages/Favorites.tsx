import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { Heart, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import pistachioImg from "@/assets/baklawa-pistachio.jpg";
import cashewImg from "@/assets/baklawa-cashew.jpg";
import walnutImg from "@/assets/baklawa-walnut.jpg";
import assortedImg from "@/assets/baklawa-assorted.jpg";

const favorites = [
  { id: "pistachio-baklawa", name: "Turkish Pistachio Baklawa", price: 2250, unit: "1kg Pack", img: pistachioImg },
  { id: "cashew-roll", name: "Cashew Roll Baklawa", price: 1900, unit: "500g Pack", img: cashewImg },
  { id: "walnut-diamond", name: "Walnut Diamond Cut", price: 1600, unit: "500g Pack", img: walnutImg },
  { id: "assorted-premium", name: "Premium Assorted Box", price: 2800, unit: "1kg Pack", img: assortedImg },
];

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN");

const Favorites = () => {
  const navigate = useNavigate();

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-5">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-2xl tracking-wide text-foreground"
        >
          Your Saved Products
        </motion.h1>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          onClick={() => toast.success("All favorites added to cart!")}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-body font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-fab"
        >
          <ShoppingCart size={16} />
          Add Entire List to Cart
        </motion.button>

        <div className="grid grid-cols-2 gap-4">
          {favorites.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              onClick={() => navigate(`/product/${item.id}`)}
              className="bg-card rounded-2xl shadow-card overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div className="relative">
                <img src={item.img} alt={item.name} className="w-full h-32 object-cover" />
                <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center">
                  <Heart size={16} className="text-primary fill-primary" />
                </div>
              </div>
              <div className="p-3 space-y-1">
                <p className="font-body font-semibold text-foreground text-xs leading-tight line-clamp-2">{item.name}</p>
                <p className="font-body text-[11px] text-muted-foreground">{item.unit}</p>
                <p className="font-body font-bold text-primary text-sm">{formatPrice(item.price)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </AppShell>
  );
};

export default Favorites;
