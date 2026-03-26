import AppShell from "@/components/AppShell";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import {
  Heart,
  ShoppingCart,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Package,
  Maximize2,
  X,
  ShieldCheck,
  Leaf,
  Thermometer,
  Scale,
  Info,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useProducts";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import ProductRecommendations from "@/components/ProductRecommendations";

const getCartonSize = (product: any) => {
  return product.packs_per_master_carton || product.packs_per_carton || 4;
};

import { calculatePackPrice, getDisplayPrice, getProductCategory, getPacksPerCarton, getMinOrderQty, getQtyIncrement, getGstRate, getHsnCode, getPrimaryPackWeightKg } from "@/utils/pricing";

const getProductPrice = (p: any): number => calculatePackPrice(p);

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const { products } = useProducts();
  const { formatPrice } = useCurrency();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [boxes, setBoxes] = useState(0); // will be set to minQty once product loads
  const [isFav, setIsFav] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const [activeImage, setActiveImage] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    window.scrollTo(0, 0);
    setLoading(true);
    setActiveImage(0);

    supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setProduct(data);
          setBoxes(getMinOrderQty(data));
        }
        setLoading(false);
      });
  }, [id]);

  const currentIndex = products.findIndex((p) => p.id === id);
  const prevProduct = currentIndex > 0 ? products[currentIndex - 1] : null;
  const nextProduct = currentIndex < products.length - 1 ? products[currentIndex + 1] : null;


  if (loading)
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  if (!product)
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Product not found</p>
        </div>
      </AppShell>
    );

  const cat = getProductCategory(product);
  const packsPerCarton = getPacksPerCarton(product);
  const minQty = getMinOrderQty(product);
  const increment = getQtyIncrement(product);
  const gstRate = getGstRate(product);
  const hsn = getHsnCode(product);
  const weightKg = getPrimaryPackWeightKg(product);
  const remainder = boxes % packsPerCarton;
  const neededToFill = remainder === 0 ? 0 : packsPerCarton - remainder;
  const progressPercentage = remainder === 0 ? 100 : (remainder / packsPerCarton) * 100;

  const images = [product.image_url].filter(Boolean);
  const price = getProductPrice(product);
  const displayPriceInfo = getDisplayPrice(product);
  const currentTotal = boxes * price;
  const currentTax = currentTotal * (gstRate / 100);
  const dietaryTags: string[] = product.dietary_tags || [];
  const isBulk = cat === "bulk_kg";
  const isPremium = cat === "premium_pc";

  const handleAddToCart = async () => {
    setIsAdding(true);
    const success = await addToCart(product.id, boxes, product.pack_size, product.carton_type);
    setIsAdding(false);
    if (success) {
      toast.success(`Added ${boxes} packs to your order!`, { icon: "📦" });
      setBoxes(1);
    }
  };

  return (
    <AppShell>
      <div className="relative">
        <div className="max-w-md mx-auto bg-muted min-h-screen pb-32 shadow-sm border-x border-border">
          {/* Top bar */}
          <div className="sticky top-0 z-20 bg-card/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-border shadow-sm">
            <button
              onClick={() => navigate("/catalogue")}
              className="flex items-center gap-1 text-foreground font-bold text-sm hover:text-primary transition-colors"
            >
              <ChevronLeft size={20} /> Catalogue
            </button>
            <button
              onClick={() => setIsFav(!isFav)}
              className="w-9 h-9 flex items-center justify-center bg-muted rounded-full border border-border"
            >
              <Heart size={18} className={isFav ? "text-rose-500 fill-rose-500" : "text-muted-foreground"} />
            </button>
          </div>

          {/* Product Image */}
          <div className="w-full bg-card relative aspect-square group">
            {images.length > 0 && (
              <div className="absolute top-4 right-4 z-10">
                <button
                  onClick={() => setShowImageModal(true)}
                  className="w-10 h-10 bg-card/80 backdrop-blur rounded-full flex items-center justify-center shadow-sm text-muted-foreground hover:text-primary"
                >
                  <Maximize2 size={18} />
                </button>
              </div>
            )}
            <img
              src={images[activeImage] || "/placeholder.svg"}
              onClick={() => images.length > 0 && setShowImageModal(true)}
              alt={product.name}
              className="w-full h-full object-contain p-8 cursor-pointer drop-shadow-xl"
            />
          </div>

          {/* Prev/Next Nav */}
          <div className="flex items-center justify-between bg-foreground text-background px-4 py-2 text-xs font-bold uppercase tracking-wider">
            <button
              onClick={() => prevProduct && navigate(`/product/${prevProduct.id}`)}
              disabled={!prevProduct}
              className="flex items-center gap-1 hover:text-primary disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span className="text-muted-foreground">|</span>
            <button
              onClick={() => nextProduct && navigate(`/product/${nextProduct.id}`)}
              disabled={!nextProduct}
              className="flex items-center gap-1 hover:text-primary disabled:opacity-30 transition-colors"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>

          {/* Product Title */}
          <div className="bg-primary text-primary-foreground px-6 py-5 flex flex-col items-center text-center">
            <h1 className="font-serif text-2xl font-bold tracking-wide">{product.name}</h1>
            <div className="flex items-center gap-2 mt-2 bg-primary-foreground/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <Package size={14} /> 1 Pack = {product.pack_size || "Standard"}
            </div>
            {product.category && (
              <p className="text-xs mt-2 text-primary-foreground/80">{product.category}{product.sub_category ? ` › ${product.sub_category}` : ""}</p>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="bg-card px-6 py-4 border-b border-border">
              <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
            </div>
          )}

          {/* Dietary Tags */}
          {dietaryTags.length > 0 && (
            <div className="bg-card px-6 py-3 border-b border-border flex flex-wrap gap-2">
              {dietaryTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs flex items-center gap-1">
                  <Leaf size={12} /> {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Pricing */}
          {isAuthenticated && (
            <div className="bg-foreground p-5 text-background">
              <div className="flex items-center justify-between mb-3 border-b border-background/10 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-primary" />
                  <p className="text-xs font-bold text-muted uppercase tracking-widest">Your Price</p>
                </div>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  {product.mrp && product.wholesale_price && product.mrp > product.wholesale_price && (
                    <p className="text-xs text-muted line-through mb-0.5">
                      MRP: {formatPrice(product.mrp)} /pack
                    </p>
                  )}
                  <p className="text-2xl font-black text-background">
                    {formatPrice(price)} <span className="text-xs font-bold text-primary">{displayPriceInfo.unit}</span>
                  </p>
                  {isBulk && weightKg > 0 && (
                    <p className="text-[10px] text-muted mt-0.5">
                      Pack price: ₹{displayPriceInfo.price}/kg × {weightKg}kg = {formatPrice(price)}
                    </p>
                  )}
                </div>
                {product.mrp && product.wholesale_price && product.mrp > product.wholesale_price && (
                  <div className="text-right">
                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">
                      Save {Math.round(((product.mrp - product.wholesale_price) / product.mrp) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Product Specs Table */}
          <div className="bg-card mb-2">
            {product.net_weight_grams && (
              <div className="grid grid-cols-2 border-b border-border">
                <div className="p-3 text-sm font-medium text-muted-foreground border-r border-border flex items-center gap-2">
                  <Scale size={14} /> Net Weight
                </div>
                <div className="p-3 text-sm font-bold text-foreground text-center">{product.net_weight_grams}g</div>
              </div>
            )}
            {product.weight_per_pc_grams && (
              <div className="grid grid-cols-2 border-b border-border bg-muted/50">
                <div className="p-3 text-sm font-medium text-muted-foreground border-r border-border">Wt Per Pc.</div>
                <div className="p-3 text-sm font-bold text-foreground text-center">{product.weight_per_pc_grams}g</div>
              </div>
            )}
            <div className="grid grid-cols-2 border-b border-border">
              <div className="p-3 text-sm font-medium text-muted-foreground border-r border-border">Shelf Life</div>
              <div className="p-3 text-sm font-bold text-foreground text-center">{product.shelf_life || "—"}</div>
            </div>
            {product.storage_type && (
              <div className="grid grid-cols-2 border-b border-border bg-muted/50">
                <div className="p-3 text-sm font-medium text-muted-foreground border-r border-border flex items-center gap-2">
                  <Thermometer size={14} /> Storage
                </div>
                <div className="p-3 text-sm font-bold text-foreground text-center">{product.storage_type}</div>
              </div>
            )}
            {product.carton_type && (
              <div className="grid grid-cols-2 border-b border-border">
                <div className="p-3 text-sm font-medium text-muted-foreground border-r border-border">Carton Type</div>
                <div className="p-3 text-sm font-bold text-foreground text-center">{product.carton_type}</div>
              </div>
            )}
            {packsPerCarton && (
              <div className="grid grid-cols-2 border-b border-border bg-muted/50">
                <div className="p-3 text-sm font-medium text-muted-foreground border-r border-border">Packs / Master Carton</div>
                <div className="p-3 text-sm font-bold text-foreground text-center">{packsPerCarton}</div>
              </div>
            )}
            {product.hsn_code && (
              <div className="grid grid-cols-2 border-b border-border">
                <div className="p-3 text-sm font-medium text-muted-foreground border-r border-border">HSN Code</div>
                <div className="p-3 text-sm font-bold text-foreground text-center font-mono">{product.hsn_code}</div>
              </div>
            )}
          </div>

          {/* Nutrition Facts */}
          {product.nutrition_facts && (
            <div className="bg-card px-6 py-4 mb-2 border-y border-border">
              <div className="flex items-center gap-2 mb-2">
                <Info size={16} className="text-primary" />
                <h3 className="text-sm font-bold text-foreground">Nutrition Facts</h3>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{product.nutrition_facts}</p>
            </div>
          )}

          {/* Add to Cart */}
          {isAuthenticated && (
            <div className="p-5 bg-card shadow-sm border-y border-border space-y-5">
              <div className="bg-muted border border-border rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                  <span>{packsPerCarton} Packs = 1 Master Carton</span>
                  <span className="text-primary">
                    {remainder === 0 ? packsPerCarton : remainder} / {packsPerCarton}
                  </span>
                </p>
                <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    className={`h-full ${remainder === 0 ? "bg-emerald-500" : "bg-primary"}`}
                  />
                </div>
                <p className="text-[11px] font-bold text-center text-muted-foreground">
                  {remainder === 0
                    ? "✨ Perfect! Master Carton Filled."
                    : `Add ${neededToFill} more packs for secure carton shipping.`}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end px-1">
                  <div>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Price</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      + GST @{gstRate}%: {formatPrice(currentTax)} {hsn ? `(HSN: ${hsn})` : ""}
                    </p>
                  </div>
                  <span className="text-2xl font-black text-primary">{formatPrice(currentTotal + currentTax)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-muted rounded-xl p-1 border border-border h-14">
                    <button
                      onClick={() => setBoxes((b) => Math.max(minQty, b - increment))}
                      className="w-12 h-full rounded-lg bg-card shadow-sm font-bold text-xl active:scale-95 text-foreground"
                    >
                      −
                    </button>
                    <span className="font-bold text-xl w-10 text-center text-foreground">{boxes}</span>
                    <button
                      onClick={() => setBoxes((b) => b + increment)}
                      className="w-12 h-full rounded-lg bg-foreground text-background shadow-sm font-bold text-xl active:scale-95"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={handleAddToCart}
                    disabled={isAdding}
                    className="flex-1 h-14 rounded-xl bg-primary text-primary-foreground font-bold text-base shadow-xl flex items-center justify-center gap-2 active:scale-95 hover:bg-primary/90 transition-colors"
                  >
                    {isAdding ? <Loader2 size={20} className="animate-spin" /> : <ShoppingCart size={20} />} Add to Order
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Related Products */}
          <ProductRecommendations title="You May Also Like" excludeProductId={id} />
        </div>

        {/* Image Modal */}
        <AnimatePresence>
          {showImageModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-sm"
            >
              <button
                onClick={() => setShowImageModal(false)}
                className="absolute top-6 right-6 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <X size={24} />
              </button>
              <img src={images[activeImage]} alt="Zoomed" className="w-full max-w-lg object-contain max-h-[80vh]" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
};

export default ProductDetail;
