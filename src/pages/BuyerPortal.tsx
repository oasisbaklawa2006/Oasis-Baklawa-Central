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

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setProducts(data as Product[]);
    } else {
      toast.error("Failed to load catalog");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const updateQuantity = (product: Product, delta: number) => {
    setCart((prev) => {
      const currentQty = prev[product.id]?.quantity || 0;
      const newQty = Math.max(0, currentQty + delta);
      const newCart = { ...prev };
      if (newQty === 0) {
        delete newCart[product.id];
      } else {
        newCart[product.id] = { product, quantity: newQty };
      }
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
      // 1. Fetch the logged-in user and their company_id from your AppGen 'users' table
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      let currentCompanyId = null;

      if (user) {
        const { data: appUser } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();

        if (appUser && "company_id" in appUser) {
          currentCompanyId = String((appUser as Record<string, unknown>).company_id);
        }
      }

      // 2. Build the order payload and safely attach the company_id (No user_id sent!)
      const orderPayload = {
        status: "submitted",
        sales_order_value: totalValue,
      };

      if (currentCompanyId) {
        Object.assign(orderPayload, { company_id: currentCompanyId });
      }

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert([orderPayload])
        .select("id")
        .single();

      if (orderError) throw orderError;

      const orderItemsPayload = cartItems.map((item) => ({
        order_id: orderData.id,
        product_id: item.product.id,
        quantity: item.quantity,
        pack_size: item.product.pack_size,
        carton_type: item.product.carton_type,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItemsPayload);

      if (itemsError) throw itemsError;

      setCart({});
      setOrderPlaced(true);
      toast.success("Order placed successfully!");
      setTimeout(() => setOrderPlaced(false), 3000);
    } catch (error) {
      console.error("Checkout failed:", error);
      toast.error("Failed to place order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavBar />

      <div className="pt-20 pb-32 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display text-2xl tracking-wide text-foreground">Wholesale Catalog</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Select products and adjust quantities for your bulk order.
          </p>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-20">
            <Package size={48} className="mx-auto text-muted-foreground/40 mb-4" />
            <p className="font-body text-muted-foreground font-semibold">Catalog is empty</p>
            <p className="font-body text-xs text-muted-foreground mt-1">No active products are available right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product, i) => {
              const qty = cart[product.id]?.quantity || 0;

              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.4 }}
                  className={`bg-card rounded-2xl border overflow-hidden transition-all duration-200 ${
                    qty > 0 ? "border-primary shadow-md" : "border-border"
                  }`}
                >
                  {/* Image */}
                  <div className="aspect-square bg-muted/30 flex items-center justify-center overflow-hidden">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package size={36} className="text-muted-foreground/30" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-3 space-y-2">
                    <h3 className="font-body font-bold text-foreground text-sm leading-tight line-clamp-2">
                      {product.name}
                    </h3>
                    <p className="font-body text-primary font-bold text-sm">₹{product.price_per_kg} / pack</p>

                    <div className="flex flex-wrap gap-1">
                      <p className="text-[10px] font-body text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                        Pack: {product.pack_size || "Standard"}
                      </p>
                      <p className="text-[10px] font-body text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                        Carton: {product.carton_type || "Standard"}
                      </p>
                    </div>

                    {/* Quantity Selector */}
                    <div className="pt-1">
                      {qty === 0 ? (
                        <button
                          onClick={() => updateQuantity(product, 1)}
                          className="w-full py-2.5 rounded-lg font-bold text-sm bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors flex items-center justify-center gap-2"
                        >
                          <Plus size={14} /> Add to Order
                        </button>
                      ) : (
                        <div className="flex items-center justify-between bg-muted/30 rounded-lg p-1">
                          <button
                            onClick={() => updateQuantity(product, -1)}
                            className="w-8 h-8 flex items-center justify-center rounded-md bg-background text-foreground shadow-sm border border-border hover:bg-muted transition-colors"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="font-body font-bold text-foreground text-sm">{qty}</span>
                          <button
                            onClick={() => updateQuantity(product, 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
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
        )}
      </div>

      {/* Floating Checkout Bar */}
      <AnimatePresence>
        {totalItems > 0 && !orderPlaced && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-card/95 backdrop-blur-md border-t border-border shadow-lg"
          >
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingCart size={22} className="text-primary" />
                  <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {totalItems}
                  </span>
                </div>
                <div>
                  <p className="font-body font-bold text-foreground text-sm">Order Total</p>
                  <p className="font-body text-primary font-bold text-lg">₹{totalValue.toLocaleString("en-IN")}</p>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={isSubmitting}
                className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Submit Order"}
                {!isSubmitting && <ArrowRight size={16} />}
              </button>
            </div>
          </motion.div>
        )}

        {/* Success Overlay */}
        {orderPlaced && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center space-y-4"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={40} className="text-emerald-600" />
              </div>
              <h2 className="font-display text-xl text-foreground">Order Submitted!</h2>
              <p className="font-body text-sm text-muted-foreground">
                Your wholesale order has been sent to the production team.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BuyerPortal;
