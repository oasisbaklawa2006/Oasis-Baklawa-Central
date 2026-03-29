import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ShoppingCart, Loader2 } from "lucide-react";
import { useCart } from "@/hooks/useCart";

interface ReorderProduct {
  id: string;
  name: string;
  image_url: string | null;
  price_per_kg: number;
  quantity: number;
}

const SmartReorderSection = () => {
  const [items, setItems] = useState<ReorderProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();

  useEffect(() => {
    const fetchReorders = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        // Get user's company
        const { data: userData } = await supabase
          .from("users")
          .select("company_id")
          .eq("id", user.id)
          .maybeSingle();

        if (!userData?.company_id) { setLoading(false); return; }

        // Get recent order items for this company
        const { data: orders } = await supabase
          .from("orders")
          .select("id")
          .eq("company_id", userData.company_id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (!orders || orders.length === 0) { setLoading(false); return; }

        const orderIds = orders.map(o => o.id);
        const { data: orderItems } = await supabase
          .from("order_items")
          .select("product_id, quantity")
          .in("order_id", orderIds);

        if (!orderItems || orderItems.length === 0) { setLoading(false); return; }

        // Aggregate quantities per product
        const qtyMap: Record<string, number> = {};
        orderItems.forEach(oi => {
          if (oi.product_id) {
            qtyMap[oi.product_id] = (qtyMap[oi.product_id] || 0) + Number(oi.quantity);
          }
        });

        // Get top 6 most ordered products
        const sortedIds = Object.entries(qtyMap)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 6)
          .map(([id]) => id);

        if (sortedIds.length === 0) { setLoading(false); return; }

        const { data: products } = await supabase
          .from("products")
          .select("id, name, image_url, price_per_kg")
          .in("id", sortedIds)
          .eq("is_active", true);

        if (products) {
          setItems(
            sortedIds
              .map(id => {
                const p = products.find(pr => pr.id === id);
                if (!p) return null;
                return { ...p, quantity: qtyMap[id] };
              })
              .filter(Boolean) as ReorderProduct[]
          );
        }
      } catch (err) {
        console.warn("SmartReorder fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReorders();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={20} className="animate-spin text-[#B8860B]" />
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="text-xl font-display font-bold text-slate-800 flex items-center gap-2 mb-1">
        <span className="text-[#B8860B]">⚡</span> Smart Reorder
      </h2>
      <p className="text-xs text-slate-500 mb-6 font-medium">Based on your recent order history</p>
      <div className="flex overflow-x-auto scrollbar-hide gap-5 pb-4 snap-x">
        {items.map((item) => (
          <div
            key={item.id}
            className="min-w-[220px] bg-white border border-slate-100 rounded-2xl p-4 snap-start shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/product/${item.id}`)}
          >
            <div className="h-32 mb-4 rounded-xl overflow-hidden bg-slate-50">
              {item.image_url ? (
                <img src={item.image_url} className="w-full h-full object-cover mix-blend-multiply" alt={item.name} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl">🍯</div>
              )}
            </div>
            <h3 className="font-bold text-slate-800 text-sm mb-3">{item.name}</h3>
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm text-slate-800">
                {formatPrice(item.price_per_kg)} <span className="text-slate-400 text-[10px]">/ kg</span>
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/product/${item.id}`); }}
                className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-[#B8860B] transition-colors"
              >
                <ShoppingCart size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default SmartReorderSection;
