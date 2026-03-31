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
          .from("users")
          .select("company_id")
          .eq("id", user.id)
          .maybeSingle();

        if (!userData?.company_id) { setLoading(false); return; }

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

        const qtyMap: Record<string, number> = {};
        orderItems.forEach(oi => {
          if (oi.product_id) {
            qtyMap[oi.product_id] = (qtyMap[oi.product_id] || 0) + Number(oi.quantity);
          }
        });

        const sortedIds = Object.entries(qtyMap)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 6)
          .map(([id]) => id);

        if (sortedIds.length === 0) { setLoading(false); return; }

        const { data: products } = await supabase
          .from("products")
          .select("id, name, image_url, price_per_kg, pack_size")
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
        <Loader2 size={20} className="animate-spin text-[#C4A052]" />
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="px-4">
      <p className="text-[10px] font-body font-semibold tracking-[0.2em] uppercase text-[#C4A052] mb-1 flex items-center gap-2">
        <span className="text-sm">⚡</span> SMART REORDER
      </p>
      <p className="text-[9px] text-muted-foreground mb-4 font-body">Based on your recent order history</p>
      <div className="flex overflow-x-auto scrollbar-hide gap-4 pb-4 snap-x">
        {items.map((item) => {
          const pricePerKg = item.price_per_kg ?? 0;
          const weightKg = parseFloat(item.pack_size || "0") || 6;
          const packPrice = pricePerKg * weightKg;

          return (
            <div
              key={item.id}
              className="min-w-[165px] max-w-[180px] bg-[#F9F8F3] border-[1.5px] border-[#C4A052]/40 rounded-[20px] p-3 snap-start cursor-pointer group relative flex flex-col"
              onClick={() => navigate(`/product/${item.id}`)}
            >
              {/* Image */}
              <div className="relative aspect-square rounded-xl overflow-hidden bg-[#F9F8F3] flex items-center justify-center mb-2">
                {item.image_url ? (
                  <img src={item.image_url} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500" alt={item.name} loading="lazy" />
                ) : (
                  <span className="text-4xl">🍯</span>
                )}
                <div className="absolute top-1.5 right-1.5 w-4 h-4 border border-[#2E7D32] rounded-sm flex items-center justify-center bg-white/80">
                  <div className="w-2 h-2 rounded-full bg-[#2E7D32]" />
                </div>
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#C4A052]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#C4A052]/30" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#C4A052]/30" />
                </div>
              </div>

              <h3 className="font-body text-[11px] font-bold text-[#4A3623] uppercase tracking-wide leading-tight line-clamp-1">{item.name}</h3>
              <p className="font-body text-[9px] text-[#4A3623] font-semibold">PACK SIZE : {item.pack_size || "6kg"}</p>
              <p className="font-body text-[9px] text-[#4A3623] font-semibold mb-1.5">PACK PRICE : {formatPrice(packPrice)}/-</p>

              <div className="flex items-end justify-between mt-auto">
                <div>
                  <p className="font-body text-base font-bold text-[#4A3623]">
                    <span className="text-[10px] align-top">₹</span> {pricePerKg > 0 ? pricePerKg.toFixed(0) : "0"}/-
                  </p>
                  <p className="font-body text-[7px] text-[#4A3623]/50 leading-tight">
                    Excluding taxes & Transportation<br />Per kg
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/product/${item.id}`); }}
                  className="w-8 h-8 rounded-full bg-[#4A3623] flex items-center justify-center hover:bg-[#C4A052] transition-colors flex-shrink-0"
                >
                  <ShoppingCart size={14} className="text-white" />
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
