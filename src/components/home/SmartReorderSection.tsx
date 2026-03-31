import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Loader2, Package } from "lucide-react";

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
        const sortedIds = Object.entries(qtyMap).sort(([, a], [, b]) => b - a).slice(0, 8).map(([id]) => id);
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
    <div className="flex justify-center py-6">
      <Loader2 size={18} className="animate-spin text-primary" />
    </div>
  );

  if (items.length === 0) return null;

  return (
    <section className="px-5">
      <h2 className="font-display text-2xl text-foreground mb-4">Order Again</h2>
      <div className="flex overflow-x-auto scrollbar-hide gap-3 pb-2 snap-x">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => navigate(`/product/${item.id}`)}
            className="min-w-[140px] max-w-[140px] snap-start cursor-pointer flex-shrink-0 group"
          >
            <div className="w-full aspect-square rounded-lg overflow-hidden bg-muted flex items-center justify-center mb-2">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              ) : (
                <Package size={20} className="text-muted-foreground" />
              )}
            </div>
            <p className="font-body text-xs text-foreground line-clamp-1 mb-0.5">{item.name}</p>
            <p className="font-body text-[11px] text-muted-foreground">
              {formatPrice(item.price_per_kg)}/kg
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default SmartReorderSection;
