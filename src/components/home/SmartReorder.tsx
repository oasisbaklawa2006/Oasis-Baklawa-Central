import { useEffect, useState } from "react";
import { RotateCcw, Loader2, ShoppingBag, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface ReorderItem {
  product_id: string;
  product_name: string;
  quantity: number;
}

const SmartReorder = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ReorderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const fetchLastOrder = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Bypassing TS for the orders fetch
        const { data, error } = await (supabase as any)
          .from("orders")
          .select(
            `
            id,
            order_items (
              product_id,
              quantity,
              products ( name )
            )
          `,
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (error && error.code !== "PGRST116") throw error;

        if (data && data.order_items) {
          const formattedItems = data.order_items
            .filter((item: any) => item.product_id)
            .map((item: any) => ({
              product_id: item.product_id,
              product_name: item.products?.name || "Unknown Product",
              quantity: item.quantity,
            }));
          setItems(formattedItems);
        }
      } catch (error) {
        console.error("Error fetching smart reorder:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLastOrder();
  }, [user]);

  const handleBulkAddToCart = async () => {
    if (!user || items.length === 0) return;

    setIsAdding(true);
    try {
      const cartInserts = items.map((item) => ({
        user_id: user.id,
        product_id: item.product_id,
        quantity: item.quantity,
      }));

      // Bypassing TS for the cart_items insert
      const { error } = await (supabase as any).from("cart_items").insert(cartInserts);

      if (error) throw error;

      toast.success("Past order added to cart!");
      navigate("/cart");
    } catch (error) {
      toast.error("Failed to add items to cart.");
      console.error(error);
    } finally {
      setIsAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 flex justify-center">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center"
      >
        <ShoppingBag size={32} className="mx-auto text-slate-300 mb-3" />
        <h2 className="font-display font-bold text-slate-800">No Past Orders Yet</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          Once you place an order, you can quickly reorder your favorites from here.
        </p>
        <button
          onClick={() => navigate("/catalog")}
          className="text-sm font-bold text-primary flex items-center justify-center gap-1 mx-auto hover:underline"
        >
          Browse Catalog <ArrowRight size={14} />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
    >
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-xl font-bold text-slate-900">Smart Reorder</h2>
        <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">
          Last Order
        </span>
      </div>
      <p className="text-xs font-medium text-slate-500 mb-5">Quickly restock your previous requested quantities.</p>

      <div className="space-y-3 mb-6">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div>
              <p className="font-bold text-slate-800 text-sm">{item.product_name}</p>
            </div>
            <div className="bg-white border border-slate-200 px-3 py-1 rounded-lg text-xs font-bold text-slate-700">
              {item.quantity}x Units
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleBulkAddToCart}
        disabled={isAdding}
        className="w-full py-3.5 rounded-xl bg-slate-900 text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2 hover:bg-black transition-colors disabled:opacity-70 shadow-md"
      >
        {isAdding ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
        Bulk Add to Cart
      </button>
    </motion.div>
  );
};

export default SmartReorder;
