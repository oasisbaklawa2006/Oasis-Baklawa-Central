import { useNavigate } from "react-router-dom";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { Package, Lock, Plus, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { getDisplayPrice, getMinOrderQty } from "@/utils/pricing";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const NewArrivals = ({ priceTier }: { priceTier?: string | null }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { formatPrice } = useCurrency();
  const { addToCart } = useCart();
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Fetch products tagged as 'new-arrivals' via product_tag_mapping
      const { data: tag } = await supabase
        .from("product_tags")
        .select("id")
        .eq("tag_key", "new-arrivals")
        .eq("is_active", true)
        .maybeSingle();

      if (!tag) { setLoading(false); return; }

      const { data: mappings } = await supabase
        .from("product_tag_mapping")
        .select("product_id, manual_sort_index")
        .eq("tag_id", tag.id)
        .order("manual_sort_index", { ascending: true })
        .limit(8);

      if (!mappings || mappings.length === 0) { setLoading(false); return; }

      const productIds = mappings.map((m: any) => m.product_id);
      const { data: products } = await supabase
        .from("products")
        .select("*")
        .in("id", productIds);

      const sorted = productIds
        .map((pid: string) => products?.find((p: any) => p.id === pid))
        .filter(Boolean);

      setArrivals(sorted);
      setLoading(false);
    })();
  }, []);

  if (loading || arrivals.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="px-5 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-6 h-[0.5px] bg-primary/40" />
          <p className="font-body text-[9px] font-medium tracking-[0.3em] uppercase text-muted-foreground">
            New Arrivals
          </p>
        </div>
        <button
          onClick={() => navigate("/catalogue")}
          className="font-body text-[8px] text-primary tracking-[0.15em] uppercase"
        >
          See All
        </button>
      </div>

      <div className="flex overflow-x-auto scrollbar-hide gap-3 px-5 pb-1 snap-x">
        {arrivals.map((product, i) => (
          <ArrivalCard
            key={product.id}
            product={product}
            index={i}
            priceTier={priceTier}
            navigate={navigate}
            formatPrice={formatPrice}
            isAuthenticated={isAuthenticated}
            addToCart={addToCart}
          />
        ))}
      </div>
    </section>
  );
};

const ArrivalCard = ({ product, index, navigate, formatPrice, isAuthenticated, addToCart, priceTier }: any) => {
  const [adding, setAdding] = useState(false);
  const displayInfo = getDisplayPrice(product, priceTier);
  const moq = getMinOrderQty(product);

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setAdding(true);
    await addToCart(product.id, moq, product.pack_size ?? null, product.carton_type ?? null);
    setAdding(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => navigate(`/product/${product.id}`)}
      className="min-w-[130px] max-w-[130px] snap-start cursor-pointer flex-shrink-0 group"
    >
      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-card border border-primary/6 flex items-center justify-center mb-2"
        style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.03)" }}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700 ease-out"
            loading="lazy"
          />
        ) : (
          <Package size={16} className="text-muted-foreground" strokeWidth={1.3} />
        )}
        <span className="absolute top-2 left-2 font-body text-[7px] tracking-[0.15em] uppercase bg-primary/90 text-white px-2 py-0.5 rounded-full">
          New
        </span>
        {isAuthenticated && (
          <button
            onClick={handleQuickAdd}
            disabled={adding}
            className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-md bg-[hsl(var(--foreground))] text-[hsl(var(--background))] flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {adding ? <Loader2 size={10} className="animate-spin" /> : <Plus size={12} />}
          </button>
        )}
      </div>
      <p className="font-serif text-[10px] text-foreground line-clamp-1 mb-0.5">
        {product.name}
      </p>
      {isAuthenticated ? (
        <p className="font-body text-[9px] text-foreground font-medium">
          {formatPrice(displayInfo.price)}
          <span className="font-normal text-muted-foreground ml-0.5">{displayInfo.unit}</span>
        </p>
      ) : (
        <p className="font-body text-[9px] text-primary flex items-center gap-0.5">
          <Lock size={8} strokeWidth={1.5} /> Login
        </p>
      )}
    </motion.div>
  );
};

export default NewArrivals;
