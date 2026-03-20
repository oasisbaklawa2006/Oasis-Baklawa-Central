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
      // 1. Fetch the logged-in user securely
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      let currentCompanyId: string | null = null;

      if (user) {
        // Fetch their company_id from their profile securely
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .maybeSingle();
        
        if (profile && typeof profile === 'object' && 'company_id' in profile) {
          currentCompanyId = String((profile as Record<string, unknown>).company_id);
        }
      }

      // 2. Build the order payload
      const orderPayload = {
        status: "submitted",
        sales_order_value: totalValue,
        user_id: user?.id || null,
        company_id: currentCompanyId || null
      };

      // 3. Create the Order record (Bypassing strict local types with 'as never')
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert([orderPayload as never])
        .select("id")
        .single();

      if (orderError) throw orderError;

      // 4. Create the Order Items records
      const orderItemsPayload = cartItems.map(item => ({
        order_id: orderData.id,
        product_id: item.product.id,
        quantity: item.quantity,
        pack_size: item.product.pack_size,
        carton_type: item.product.carton_type,
        price_at_time_of_order: item.product.price_per_kg 
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItemsPayload as never[]);

      if (itemsError) throw itemsError;

      // Success Reset
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