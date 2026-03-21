import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Loader2, ShoppingCart, Plus, Minus, Package, ArrowRight, CheckCircle2, History, Star } from "lucide-react";
import TopNavBar from "@/components/TopNavBar";

interface Product {
  id: string;
  name: string;
  price_per_kg: number;
  pack_size: string | null;
  carton_type: string | null;
  image_url: string | null;
  is_active: boolean;
}

interface CartItem {
  product: Product;
  quantity: number;
}

const BuyerPortal = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      // 1. Fetch All Active Products
      const { data: allProducts } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (allProducts) setProducts(allProducts as Product[]);

      // 2. Premium Feature: Fetch "Recently Ordered" for this specific company
      if (user) {
        const { data: appUser } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
        if (appUser?.company_id) {
          const { data: pastOrders } = await supabase
            .from("orders")
            .select(`id, order_items(product_id)`)
            .eq("company_id", appUser.company_id)
            .order("created_at", { ascending: false })
            .limit(3);

          if (pastOrders) {
            const productIds = pastOrders.flatMap((o) => o.order_items.map((i: any) => i.product_id));
            const uniqueIds = Array.from(new Set(productIds));
            const recent = allProducts?.filter((p) => uniqueIds.includes(p.id)).slice(0, 4);
            setRecentProducts(recent || []);
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updateQuantity = (product: Product, delta: number) => {
    setCart((prev) => {
      const currentQty = prev[product.id]?.quantity || 0;
      const newQty = Math.max(0, currentQty + delta);
      const newCart = { ...prev };
      if (newQty === 0) delete newCart[product.id];
      else newCart[product.id] = { product, quantity: newQty };
      return newCart;
    });
  };

  const cartItems = Object.values(cart);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = cartItems.reduce((sum, item) => sum + item.product.price_per_kg * item.quantity, 0);

  const handlePlaceOrder = async () => {
    if (totalItems === 0) return;
    setIsSubmitting(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const { data: appUser } = await supabase
        .from("users")
        .select("company_id")
        .eq("id", authData.user?.id)
        .maybeSingle();

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert([
          {
            status: "submitted",
            sales_order_value: totalValue,
            company_id: appUser?.company_id,
          },
        ])
        .select("id")
        .single();

      if (orderError) throw orderError;

      const items = cartItems.map((item) => ({
        order_id: orderData.id,
        product_id: item.product.id,
        quantity: item.quantity,
        price_at_time_of_order: item.product.price_per_kg,
      }));

      await supabase.from("order_items").insert(items);
      setCart({});
      setOrderPlaced(true);
      toast.success("Order sent to the bakery!");
      setTimeout(() => setOrderPlaced(false), 3000);
    } catch (error) {
      toast.error("Connection issue. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );

  return (
    <div className="min-h-screen bg-[#FDFCFB] pb-32">
      {" "}
      {/* Oasis Cream Background */}
      <TopNavBar />
      <div className="pt-24 px-4 sm:px-6 max-w-6xl mx-auto">
        {/* --- Section 1: The "Pleasure" Header --- */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-10">
          <h1 className="font-display text-3xl font-light tracking-tight text-slate-900">Welcome to Oasis</h1>
          <p className="font-body text-slate-500 mt-2 italic">Select your fresh batches for the week.</p>
        </motion.div>

        {/* --- Section 2: Quick Reorder (The Star of the show) --- */}
        <AnimatePresence>
          {recentProducts.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
              <div className="flex items-center gap-2 mb-4">
                <Star size={18} className="text-amber-500 fill-amber-500" />
                <h2 className="font-display text-sm uppercase tracking-widest font-bold text-slate-400">
                  Your Favorites
                </h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                {recentProducts.map((product) => (
                  <button
                    key={`fav-${product.id}`}
                    onClick={() => updateQuantity(product, 1)}
                    className="flex-shrink-0 w-40 bg-white border border-slate-100 rounded-2xl p-3 shadow-sm hover:shadow-md transition-all text-left group"
                  >
                    <div className="h-24 bg-slate-50 rounded-xl mb-3 overflow-hidden">
                      <img
                        src={product.image_url || ""}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                    <p className="font-body font-bold text-xs truncate text-slate-800">{product.name}</p>
                    <p className="text-[10px] text-primary font-bold mt-1">₹{product.price_per_kg}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- Section 3: Main Catalog --- */}
        <div className="mb-6 flex items-center gap-2">
          <Package size={18} className="text-slate-400" />
          <h2 className="font-display text-sm uppercase tracking-widest font-bold text-slate-400">Full Collection</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product, i) => {
            const qty = cart[product.id]?.quantity || 0;
            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={`group bg-white rounded-3xl border transition-all duration-300 ${qty > 0 ? "border-primary ring-1 ring-primary/20 shadow-xl scale-[1.02]" : "border-slate-100 shadow-sm hover:shadow-md"}`}
              >
                <div className="aspect-[4/5] overflow-hidden rounded-t-3xl bg-slate-50">
                  <img
                    src={product.image_url || ""}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-body font-bold text-slate-800 text-sm h-10 line-clamp-2">{product.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-primary font-bold text-base">₹{product.price_per_kg}</span>
                    <span className="text-[10px] text-slate-400">/ per pack</span>
                  </div>

                  <div className="mt-4">
                    {qty === 0 ? (
                      <button
                        onClick={() => updateQuantity(product, 1)}
                        className="w-full py-2.5 rounded-xl font-bold text-xs bg-slate-900 text-white hover:bg-primary transition-colors shadow-sm active:scale-95"
                      >
                        Add to Order
                      </button>
                    ) : (
                      <div className="flex items-center justify-between bg-slate-100 rounded-xl p-1">
                        <button
                          onClick={() => updateQuantity(product, -1)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-slate-900 shadow-sm"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="font-bold text-sm text-slate-900">{qty}</span>
                        <button
                          onClick={() => updateQuantity(product, 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-white shadow-sm"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
      {/* --- Section 4: The Floating Checkout Experience --- */}
      <AnimatePresence>
        {totalItems > 0 && !orderPlaced && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-6 left-0 right-0 z-50 px-4"
          >
            <div className="max-w-xl mx-auto bg-slate-900 text-white p-4 rounded-3xl shadow-2xl flex items-center justify-between border border-white/10 backdrop-blur-xl">
              <div className="flex items-center gap-4 pl-2">
                <div className="h-10 w-10 bg-primary/20 rounded-full flex items-center justify-center">
                  <ShoppingCart size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Checkout</p>
                  <p className="text-lg font-bold">₹{totalValue.toLocaleString("en-IN")}</p>
                </div>
              </div>
              <button
                onClick={handlePlaceOrder}
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Send Order"}
                <ArrowRight size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BuyerPortal;
