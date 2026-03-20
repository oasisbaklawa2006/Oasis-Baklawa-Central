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
  const totalValue = cartItems.reduce((sum, item) => sum + (item.product.price_per_kg * item.quantity), 0);

  const handlePlaceOrder = async () => {
    if (totalItems === 0) return;
    setIsSubmitting(true);

    try {
      // 1. Fetch the logged-in user's company
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      let currentCompanyId = null;

      if (user) {
        const { data: appUser } = await supabase
          .from("users")
          .select("company_id")
          .eq("id", user.id)
          .maybeSingle();
        
        if (appUser && 'company_id' in appUser) {
          currentCompanyId = String((appUser as Record<string, unknown>).company_id);
        }
      }

      // 2. Build the Order - ONLY sending company_id this time!
      const baseOrder = {
        status: "submitted",
        sales_order_value: totalValue,
      };
      
      Object.assign(baseOrder, {
        company_id: currentCompanyId || null
      });

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert([baseOrder])
        .select("id")
        .single();

      if (orderError) throw orderError;

      // 3. Build the Order Items
      const orderItemsPayload = cartItems.map(item => {
        const baseItem = {
          order_id: orderData.id,
          product_id: item.product.id,
          quantity: item.quantity,
          pack_size: item.product.pack_size,
          carton_type: item.product.carton_type,
        };
        
        Object.assign(baseItem, {
          price_at_time_of_order: item.product.price_per_kg 
        });
        
        return baseItem;
      });

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItemsPayload);

      if (itemsError) throw itemsError;

      // 4. Success Reset
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
    return <div className="min-h-screen flex justify-center items-center bg-background"><Loader2 size={32} className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-32 overflow-x-hidden">
      <TopNavBar />
      
      <main className="pt-24 px-5 max-w-6xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-display-h2 text-foreground">Wholesale Catalog</h1>
          <p className="text-body-p2 text-muted-foreground mt-1">Select products and adjust quantities for your bulk order.</p>
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
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className={`bg-card border rounded-2xl overflow-hidden shadow-sm transition-all ${qty > 0 ? 'border-primary shadow-md' : 'border-border'}`}
                >
                  <div className="h-48 bg-muted/30 relative flex items-center justify-center border-b border-border overflow-hidden">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <Package size={32} className="text-muted-foreground/30" />
                    )}
                  </div>
                  
                  <div className="p-5 flex flex-col">
                    <h3 className="text-sm font-bold text-foreground line-clamp-2 min-h-[40px]">{product.name}</h3>
                    <p className="text-primary font-bold mt-2 text-lg">₹{product.price_per_kg} <span className="text-xs text-muted-foreground font-normal">/ pack</span></p>
                    
                    <div className="mt-2 space-y-1 mb-6">
                      <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Pack:</span> {product.pack_size || "Standard"}</p>
                      <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Carton:</span> {product.carton_type || "Standard"}</p>
                    </div>

                    <div className="mt-auto border-t border-border pt-4">
                      {qty === 0 ? (
                        <button 
                          onClick={() => updateQuantity(product, 1)}
                          className="w-full py-2.5 rounded-lg font-bold text-sm bg-primary/10 text-primary hover:bg-primary hover:text-white transition