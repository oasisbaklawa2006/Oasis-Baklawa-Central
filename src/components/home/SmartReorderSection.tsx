import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ShoppingCart, Loader2 } from "lucide-react";

interface ReorderProduct {
  id: string;
  name: string;
  image_url: string | null;
  price_per_kg: number;
  pack_size: string | null;
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
        const { data: userData } = await supabase
          .from("users").select("company_id").eq("id", user.id).maybeSingle();
        if (!userData?.company_id) { setLoading(false); return; }
        const { data: orders } = await supabase
          .from("orders").select("id").eq("company_id", userData.company_id)
          .order("created_at", { ascending: false }).limit(10);
        if (!orders || orders.length === 0) { setLoading(false); return; }
        const orderIds = orders.map(o => o.id);
        const { data: orderItems } = await supabase
          .from("order_items").select("product_id, quantity").in("order_id", orderIds);
        if (!orderItems || orderItems.length === 0) { setLoading(false); return; }
        const qtyMap: Record<string, number> = {};
        orderItems.forEach(oi => {
          if (oi.product_id) qtyMap[oi.product_id] = (qtyMap[oi.product_id] || 0) + Number(oi.quantity);
        });
        const sortedIds = Object.entries(qtyMap).sort(([, a], [, b]) => b - a).slice(0, 6).map(([id]) => id);
        if (sortedIds.length === 0) { setLoading(false); return; }
        const { data: products } = await supabase
          .from("products").select("id, name, image_url, price_per_kg, pack_size")
          .in("id", sortedIds).eq("is_active", true);
        if (products) {
          setItems(sortedIds.map(id => {
            const p = products.find(pr => pr.id === id);
            if (!p) return null;
            return { ...p, quantity: qtyMap[id] };
          }).filter(Boolean) as ReorderProduct[]);
        }
      } catch (err) {
        console.warn("SmartReorder fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReorders();
  }, []);

  if (loading) return (
    <div className="flex justify-center py-8">
      <Loader2 size={20} className="animate-spin text-[#C4A052]" />
    </div>
  );

  if (items.length === 0) return null;

  return (
    <section className="px-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-[1px] bg-[#C4A052]" />
        <p className="text-[9px] font-body font-medium tracking-[0.3em] uppercase text-[#C4A052]">
          Smart Reorder
        </p>
      </div>
      <p className="text-[9px] text-[#1A120B]/30 mb-5 font-body tracking-wider uppercase">Based on your recent orders</p>

      <div className="flex overflow-x-auto scrollbar-hide gap-5 pb-4 snap-x -mx-2 px-2">
        {items.map((item) => {
          const pricePerKg = item.price_per_kg ?? 0;

          return (
            <div
              key={item.id}
              className="min-w-[200px] max-w-[220px] snap-start cursor-pointer group flex flex-col bg-transparent"
              onClick={() => navigate(`/product/${item.id}`)}
            >
              {/* Image */}
              <div className="relative aspect-[3/4] rounded-[16px] overflow-hidden bg-[#F0EDE4] flex items-center justify-center mb-3">
                {item.image_url ? (
                  <img src={item.image_url} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-700 ease-out" alt={item.name} loading="lazy" />
                ) : (
                  <span className="text-4xl">🍯</span>
                )}
                <div className="absolute top-2 right-2 w-4 h-4 border border-[#2E7D32] rounded-sm flex items-center justify-center bg-[#F9F8F3]/90">
                  <div className="w-2 h-2 rounded-full bg-[#2E7D32]" />
                </div>
              </div>

              <p className="font-body text-[9px] font-medium tracking-[0.2em] uppercase text-[#C4A052] mb-1">Reorder · {item.quantity} ordered</p>
              <h3 className="font-display text-[14px] font-semibold text-[#1A120B] leading-tight line-clamp-2 mb-2">{item.name}</h3>

              <div className="flex items-end justify-between mt-auto">
                <div>
                  <p className="font-display text-lg font-bold text-[#1A120B]">
                    <span className="text-[10px] align-top font-body font-light">₹</span>{pricePerKg > 0 ? pricePerKg.toFixed(0) : "0"}
                    <span className="text-[9px] font-body font-light text-[#1A120B]/40 ml-0.5">/kg</span>
                  </p>
                  <p className="font-body text-[7px] text-[#1A120B]/30 tracking-wider uppercase">excl. taxes</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/product/${item.id}`); }}
                  className="w-9 h-9 rounded-full border border-[#C4A052] text-[#C4A052] hover:bg-[#C4A052] hover:text-white flex items-center justify-center flex-shrink-0 transition-all duration-300"
                >
                  <ShoppingCart size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default SmartReorderSection;
