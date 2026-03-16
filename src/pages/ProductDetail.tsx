import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Heart, ShoppingCart, Minus, Plus, AlertTriangle, Lock, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useNavigate, useParams } from "react-router-dom";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/hooks/useProducts";

const getMinPacks = (cartonType: string | null) => (cartonType === "C" ? 3 : 1);
const getCartonSize = (cartonType: string | null) => (cartonType === "C" ? 9 : 12);

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(3);
  const [isFav, setIsFav] = useState(false);
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!id) return;
    supabase.from("products").select("*").eq("id", id).single().then(({ data, error }) => {
      if (!error && data) { setProduct(data); setQty(getMinPacks(data.carton_type)); }
      setLoading(false);
    });
  }, [id]);

  if (loading) return <AppShell><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppShell>;
  if (!product) return <AppShell><div className="flex flex-col items-center justify-center min-h-[60vh] gap-3"><p className="text-body-p2 text-muted-foreground">Product not found</p><button onClick={() => navigate("/catalogue")} className="text-primary text-ui-button hover:underline">Back to Catalogue</button></div></AppShell>;

  const minPacks = getMinPacks(product.carton_type);
  const cartonSize = getCartonSize(product.carton_type);
  const adjustQty = (delta: number) => setQty((prev) => { const next = prev + delta; if (next < minPacks) return minPacks; if (next > cartonSize * 3) return prev; return next; });
  const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        {/* Hero Image */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative w-full aspect-[4/3] sm:aspect-[16/10] overflow-hidden">
          <img src={product.image_url || "/placeholder.svg"} alt={product.name} className="w-full h-full object-cover" />
          <button onClick={() => setIsFav(!isFav)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-card/80 backdrop-blur flex items-center justify-center shadow-card">
            <Heart size={20} className={isFav ? "text-primary fill-primary" : "text-muted-foreground"} />
          </button>
        </motion.div>

        <div className="px-5 py-6 space-y-6">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
            <h1 className="text-display-h1 text-foreground">{product.name}</h1>
            {isAuthenticated ? (
              <>
                <p className="text-ui-kpi text-xl text-foreground">
                  {formatPrice(product.price_per_kg)}{" "}
                  <span className="text-fine text-muted-foreground">per kg</span>
                </p>
                <p className="text-fine text-muted-foreground">+ taxes extra · Ex-works</p>
                <p className="text-fine text-muted-foreground">Pack Size: {product.pack_size || "1kg"}</p>
              </>
            ) : (
              <p className="text-body-p2 text-muted-foreground flex items-center gap-1.5 mt-1">
                <Lock size={14} /> Trade Members Only — Login to view pricing
              </p>
            )}
          </motion.div>

          {/* Tabs */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Tabs defaultValue="description" className="w-full">
              <TabsList className="w-full bg-muted/60 rounded-xl p-1">
                <TabsTrigger value="description" className="flex-1 rounded-lg text-ui-button data-[state=active]:bg-card data-[state=active]:shadow-card">Description</TabsTrigger>
                <TabsTrigger value="specs" className="flex-1 rounded-lg text-ui-button data-[state=active]:bg-card data-[state=active]:shadow-card">Specifications</TabsTrigger>
              </TabsList>

              <TabsContent value="description" className="mt-4">
                <div className="bg-card rounded-2xl shadow-card p-5">
                  <p className="text-body-p2 text-foreground leading-relaxed">{product.description || "No description available."}</p>
                </div>
              </TabsContent>

              <TabsContent value="specs" className="mt-4">
                <div className="bg-card rounded-2xl shadow-card p-5 space-y-0">
                  {[
                    { label: "Shelf Life", value: product.shelf_life || "—" },
                    { label: "Storage", value: product.storage_type || "—" },
                    { label: "Carton Category", value: product.carton_type ? `${product.carton_type} (${cartonSize} Packs/Carton)` : "—" },
                    { label: "Min. Order Qty", value: `${minPacks} Packs (${product.pack_size || "1kg"} each)` },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between py-3 border-b border-border/50 last:border-0">
                      <span className="text-ui-label text-muted-foreground">{row.label}</span>
                      <span className="text-ui-cell font-semibold text-foreground">{row.value}</span>
                    </div>
                  ))}
                  <p className="text-fine-xs text-muted-foreground pt-3 italic">MOQ subject to carton category. Ex-works pricing.</p>
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>

          {isAuthenticated ? (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-2xl shadow-card p-5 space-y-4">
              <h3 className="text-ui-h4 text-foreground">Order Quantity</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => adjustQty(-1)} className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center hover:border-primary/50 transition-colors">
                    <Minus size={16} className="text-foreground" />
                  </button>
                  <div className="text-center min-w-[60px]">
                    <p className="text-ui-kpi text-xl text-foreground">{qty}</p>
                    <p className="text-fine text-muted-foreground">× {product.pack_size || "1kg"} Packs</p>
                  </div>
                  <button onClick={() => adjustQty(1)} className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center hover:border-primary/50 transition-colors">
                    <Plus size={16} className="text-foreground" />
                  </button>
                </div>
                <p className="text-ui-kpi text-lg text-foreground">
                  {formatPrice(product.price_per_kg)}
                  <span className="text-fine text-muted-foreground"> /kg</span>
                </p>
              </div>

              {qty < minPacks && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/15">
                  <AlertTriangle size={12} className="text-destructive" />
                  <p className="text-fine text-destructive font-medium">
                    Minimum {minPacks} packs required for Category {product.carton_type}
                  </p>
                </div>
              )}

              <button
                onClick={async () => {
                  const success = await addToCart(product.id, qty, product.pack_size || "1kg", product.carton_type ? `Category ${product.carton_type}` : undefined);
                  if (success) navigate("/cart");
                }}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-ui-button flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-fab"
              >
                <ShoppingCart size={18} />
                Add {qty} × {product.pack_size || "1kg"} Packs to Cart
              </button>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-2xl shadow-card p-5 space-y-3 text-center">
              <Lock size={20} className="mx-auto text-muted-foreground" />
              <p className="text-body-p2 text-muted-foreground">Trade Members Only — Login to view pricing</p>
              <button onClick={() => navigate("/login")} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-ui-button hover:bg-primary/90 transition-colors">
                Login / Apply for B2B Access
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default ProductDetail;
