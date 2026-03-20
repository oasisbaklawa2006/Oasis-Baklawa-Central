import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Loader2, ShoppingCart, Plus, Minus, Package, ArrowRight, CheckCircle2 } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (!error && data) setProducts(data as Product[]);
      setLoading(false);
    };
    fetchProducts();
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
      // 1. Send the basic order (No confusing user tables here!)
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert([{ status: "submitted", sales_order_value: totalValue }])
        .select("id")
        .single();

      if (orderError) throw orderError;

      // 2. Send the items
      const orderItemsPayload = cartItems.map((item) => {
        const baseItem = {
          order_id: orderData.id,
          product_id: item.product.id,
          quantity: item.quantity,
          pack_size: item.product.pack_size,
          carton_type: item.product.carton_type,
        };
        // Safely slip the price in
        Object.assign(baseItem, { price_at_time_of_order: item.product.price_per_kg });
        return baseItem;
      });

      const { error: itemsError } = await supabase.from("order_items").insert(orderItemsPayload);
      if (itemsError) throw itemsError;

      // 3. Reset and show Success
      setCart({});
      setOrderPlaced(true);
      toast.success("Order placed successfully!");
      setTimeout(() => setOrderPlaced(false), 3000);
    } catch (error) {
      console.error(error);
      toast.error("Failed to place order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex justify-center items-center bg-background">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );

  return (
    <div className="min-h-screen bg-background pb-32 overflow-x-hidden">
      <TopNavBar />
      <main className="pt-24 px-5 max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-display-h2 text-foreground">Wholesale Catalog</h1>
          <p className="text-body-p2 text-muted-foreground mt-1">
            Select products and adjust quantities for your bulk order.
          </p>
        </div>

        {products.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-16 text-center shadow-sm">
            <Package size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold">Catalog is empty</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => {
              const qty = cart[product.id]?.quantity || 0;
              return (
                <div
                  key={product.id}
                  className={`bg-card border rounded-2xl overflow-hidden shadow-sm ${qty > 0 ? "border-primary shadow-md" : "border-border"}`}
                >
                  <div className="h-48 bg-muted/30 flex items-center justify-center border-b border-border">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package size={32} className="text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="p-5 flex flex-col">
                    <h3 className="text-sm font-bold line-clamp-2 min-h-[40px]">{product.name}</h3>
                    <p className="text-primary font-bold mt-2 text-lg">₹{product.price_per_kg}</p>
                    <div className="mt-auto border-t border-border pt-4">
                      {qty === 0 ? (
                        <button
                          onClick={() => updateQuantity(product, 1)}
                          className="w-full py-2.5 rounded-lg font-bold text-sm bg-primary/10 text-primary flex items-center justify-center gap-2"
                        >
                          <Plus size={16} /> Add
                        </button>
                      ) : (
                        <div className="flex items-center justify-between bg-muted/30 rounded-lg p-1 border border-border">
                          <button
                            onClick={() => updateQuantity(product, -1)}
                            className="w-8 h-8 flex items-center justify-center rounded-md bg-background shadow-sm border"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="font-bold text-sm w-12 text-center">{qty}</span>
                          <button
                            onClick={() => updateQuantity(product, 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <AnimatePresence>
        {totalItems > 0 && !orderPlaced && (
          <motion.div
            key="cart"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-0 right-0 z-50 px-4 flex justify-center"
          >
            <div className="bg-foreground text-background shadow-2xl rounded-2xl p-4 w-full max-w-3xl flex items-center justify-between border">
              <div className="flex items-center gap-4">
                <ShoppingCart size={20} className="text-background" />
                <div>
                  <p className="text-xl font-bold">₹{totalValue.toLocaleString("en-IN")}</p>
                </div>
              </div>
              <button
                onClick={handlePlaceOrder}
                disabled={isSubmitting}
                className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-70"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Submit Order"}
                {!isSubmitting && <ArrowRight size={18} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BuyerPortal;
