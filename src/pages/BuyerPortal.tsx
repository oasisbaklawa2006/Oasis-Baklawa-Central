import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Loader2, ShoppingCart, Plus, Minus, Package, ArrowRight, CheckCircle2 } from "lucide-react";
import TopNavBar from "@/components/TopNavBar";

// ─── Types ───
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

  // NEW: Store the logged-in buyer's context
  const [buyerInfo, setBuyerInfo] = useState<{ userId: string | null; companyId: string | null }>({
    userId: null,
    companyId: null,
  });

  const initializePortal = async () => {
    setLoading(true);

    // 1. Fetch Logged-In User & Company ID
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Look up their company_id safely
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .maybeSingle();

        setBuyerInfo({
          userId: user.id,
          companyId: !profileError && profile ? profile.company_id : null,
        });
      }
    } catch (err) {
      console.warn("Could not fetch user profile context", err);
    }

    // 2. Fetch Active Products
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
    initializePortal();
  }, []);

  // Cart Logic
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

  // Submit Order
  const handlePlaceOrder = async () => {
    if (totalItems === 0) return;
    setIsSubmitting(true);

    try {
      // Step A: Create the Order record WITH User Context
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert([
          {
            status: "submitted",
            sales_order_value: totalValue,
            user_id: buyerInfo.userId, // Mapped!
            company_id: buyerInfo.companyId, // Mapped!
          },
        ])
        .select("id")
        .single();

      if (orderError) throw orderError;

      // Step B: Create the Order Items records
      const orderItemsPayload = cartItems.map((item) => ({
        order_id: orderData.id,
        product_id: item.product.id,
        quantity: item.quantity,
        pack_size: item.product.pack_size,
        carton_type: item.product.carton_type,
        price_at_time_of_order: item.product.price_per_kg,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItemsPayload);

      if (itemsError) throw itemsError;

      // Step C: Success!
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
      <div className="min-h-screen flex justify-center items-center bg-background">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32 overflow-x-hidden">
      <TopNavBar />

      <main className="pt-24 px-5 max-w-6xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-display-h2 text-foreground">Wholesale Catalog</h1>
          <p className="text-body-p2 text-muted-foreground mt-1">
            Select products and adjust quantities for your bulk order.
          </p>
        </motion.div>

        {products.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-16 text-center shadow-sm">
            <Package size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold text-foreground">Catalog is empty</h3>
            <p className="text-muted-foreground mt-1">No active products are available right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product, i) => {
              const qty = cart[product.id]?.quantity || 0;

              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`bg-card border rounded-2xl overflow-hidden shadow-sm transition-all ${qty > 0 ? "border-primary shadow-md" : "border-border"}`}
                >
                  <div className="h-48 bg-muted/30 relative flex items-center justify-center border-b border-border overflow-hidden">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <Package size={32} className="text-muted-foreground/30" />
                    )}
                  </div>

                  <div className="p-5 flex flex-col">
                    <h3 className="text-sm font-bold text-foreground line-clamp-2 min-h-[40px]">{product.name}</h3>
                    <p className="text-primary font-bold mt-2 text-lg">
                      ₹{product.price_per_kg} <span className="text-xs text-muted-foreground font-normal">/ pack</span>
                    </p>

                    <div className="mt-2 space-y-1 mb-6">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Pack:</span> {product.pack_size || "Standard"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Carton:</span>{" "}
                        {product.carton_type || "Standard"}
                      </p>
                    </div>

                    <div className="mt-auto border-t border-border pt-4">
                      {qty === 0 ? (
                        <button
                          onClick={() => updateQuantity(product, 1)}
                          className="w-full py-2.5 rounded-lg font-bold text-sm bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors flex items-center justify-center gap-2"
                        >
                          <Plus size={16} /> Add to Order
                        </button>
                      ) : (
                        <div className="flex items-center justify-between bg-muted/30 rounded-lg p-1 border border-border">
                          <button
                            onClick={() => updateQuantity(product, -1)}
                            className="w-8 h-8 flex items-center justify-center rounded-md bg-background text-foreground shadow-sm border border-border hover:bg-muted transition-colors"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="font-bold text-sm w-12 text-center">{qty}</span>
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
      </main>

      <AnimatePresence>
        {totalItems > 0 && !orderPlaced && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-0 right-0 z-50 px-4 flex justify-center"
          >
            <div className="bg-foreground text-background shadow-2xl rounded-2xl p-4 w-full max-w-3xl flex items-center justify-between border border-border/10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-background/20 rounded-full flex items-center justify-center relative">
                  <ShoppingCart size={20} className="text-background" />
                  <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-foreground">
                    {totalItems}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-background/70 uppercase tracking-wider">Order Total</p>
                  <p className="text-xl font-bold">₹{totalValue.toLocaleString("en-IN")}</p>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={isSubmitting}
                className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold text-sm hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-70"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Submit Order"}
                {!isSubmitting && <ArrowRight size={18} />}
              </button>
            </div>
          </motion.div>
        )}

        {orderPlaced && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-card p-8 rounded-3xl border border-border shadow-2xl text-center max-w-sm w-full mx-4"
            >
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Order Submitted!</h2>
              <p className="text-muted-foreground text-sm">
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
