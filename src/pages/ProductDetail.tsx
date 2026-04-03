import AppShell from "@/components/AppShell";
import { useState, useEffect } from "react";
import {
  ShoppingCart,
  Loader2,
  Package,
  Plus,
  Minus,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ProductRecommendations from "@/components/ProductRecommendations";

import {
  calculatePackPrice,
  getDisplayPrice,
  getProductCategory,
  getPacksPerCarton,
  getMinOrderQty,
  getQtyIncrement,
  getGstRate,
  getPrimaryPackWeightKg,
  unitsToFillCarton,
  calculateLineGrandTotal,
} from "@/utils/pricing";

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAuthenticated, priceTier } = useAuth();
  const { formatPrice } = useCurrency();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [boxes, setBoxes] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (!id) return;
    window.scrollTo(0, 0);
    setLoading(true);
    supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setProduct(data);
          setBoxes(0);
        }
        setLoading(false);
      });
  }, [id]);

  if (loading)
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );

  if (!product)
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground font-body text-sm">Product not found</p>
        </div>
      </AppShell>
    );

  const cat = getProductCategory(product);
  const minQty = getMinOrderQty(product);
  const increment = getQtyIncrement(product);
  const gstRate = getGstRate(product);
  const weightKg = getPrimaryPackWeightKg(product);
  const price = calculatePackPrice(product);
  const displayInfo = getDisplayPrice(product);
  const grandTotal = calculateLineGrandTotal(product, boxes);
  const toFill = unitsToFillCarton(product, boxes);
  const isBulk = cat === "bulk_kg";
  const images = [product.image_url].filter(Boolean);
  const heroImages = images.length > 0 ? images : ["/placeholder.svg"];

  const handleAddToCart = async () => {
    if (boxes <= 0) return;
    setIsAdding(true);
    const success = await addToCart(product.id, boxes, product.pack_size, product.carton_type);
    setIsAdding(false);
    if (success) {
      toast.success(`Added ${boxes} packs to your order!`, { icon: "📦" });
      setBoxes(0);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActiveSlide(idx);
  };

  const infoLines = [
    product.shelf_life && `Shelf Life: ${product.shelf_life}`,
    product.storage_type && `Storage: ${product.storage_type}`,
    getPacksPerCarton(product) && `Master Carton: ${getPacksPerCarton(product)} packs`,
  ].filter(Boolean);

  return (
    <AppShell>
      <div className="relative min-h-screen bg-background pb-36">

        {/* ─── Hero Image ─── */}
        <div className="relative w-full" style={{ height: 280 }}>
          <div
            className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
            onScroll={handleScroll}
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {heroImages.map((img, i) => (
              <div key={i} className="min-w-full h-full snap-center flex items-center justify-center p-8 bg-background">
                <img
                  src={img}
                  alt={`${product.name} ${i + 1}`}
                  className="w-full h-full object-contain"
                />
              </div>
            ))}
          </div>
          {/* Dots */}
          {heroImages.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
              {heroImages.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === activeSlide ? "bg-primary" : "bg-border"}`} />
              ))}
            </div>
          )}
        </div>

        {/* ─── Product Info ─── */}
        <div className="px-5 pt-5 space-y-4">
          <div>
            <h1 className="font-display text-xl text-foreground leading-snug">{product.name}</h1>
            <p className="font-body text-xs text-muted-foreground mt-1">
              {product.sub_category || product.category}
            </p>
          </div>

          {product.description && (
            <p className="font-body text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {product.description}
            </p>
          )}

          {/* Price */}
          {isAuthenticated && (
            <div className="space-y-1">
              <p className="font-body text-lg text-foreground font-medium">
                {formatPrice(displayInfo.price)} <span className="text-sm font-normal text-muted-foreground">{displayInfo.unit}</span>
              </p>
              {isBulk && weightKg > 0 ? (
                <p className="font-body text-sm text-muted-foreground">
                  Pack: {weightKg} kg · {formatPrice(price)}
                </p>
              ) : (
                <p className="font-body text-sm text-muted-foreground">
                  Pack: {product.pack_size || "Standard"} · {formatPrice(price)}
                </p>
              )}
            </div>
          )}

          {/* Inline Info */}
          {infoLines.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-border">
              {infoLines.map((line, i) => (
                <p key={i} className="font-body text-xs text-muted-foreground">{line}</p>
              ))}
            </div>
          )}
        </div>

        {/* ─── Recommendations ─── */}
        <div className="mt-8">
          <ProductRecommendations title="You may also like" excludeProductId={id} />
        </div>

        {/* ─── Sticky Bottom Bar ─── */}
        {isAuthenticated && (
          <div className="fixed bottom-0 left-0 right-0 z-30">
            <div className="max-w-md mx-auto bg-card border-t border-border px-5 py-3 shadow-nav">
              {/* Carton helper */}
              {boxes > 0 && toFill > 0 && (
                <p className="font-body text-[10px] text-primary text-center mb-2">
                  Add {toFill} more to complete a master carton
                </p>
              )}
              <div className="flex items-center justify-between gap-3">
                {/* Price */}
                <div className="flex-shrink-0">
                  <p className="font-body text-[9px] text-muted-foreground uppercase tracking-wider">
                    Total incl. GST@{gstRate}%
                  </p>
                  <p className="font-body text-lg font-medium text-foreground">{formatPrice(grandTotal)}</p>
                </div>

                {/* Qty */}
                <div className="flex flex-col items-center">
                  <div className="flex items-center bg-muted rounded-full px-1 py-1 gap-0">
                    <button
                      onClick={() => setBoxes((b) => {
                        if (b <= 0) return 0;
                        if (b <= minQty) return 0;
                        const next = b - increment;
                        return next < minQty ? 0 : next;
                      })}
                      className="w-8 h-8 rounded-full bg-foreground text-primary-foreground flex items-center justify-center"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="font-body font-medium text-sm w-8 text-center text-foreground">{boxes}</span>
                    <button
                      onClick={() => setBoxes((b) => (b === 0 ? minQty : b + increment))}
                      className="w-8 h-8 rounded-full bg-foreground text-primary-foreground flex items-center justify-center"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <p className="font-body text-[9px] text-muted-foreground mt-1">MOQ: {minQty} | Pack Size: {increment}</p>
                </div>

                {/* Add to Cart */}
                <button
                  onClick={handleAddToCart}
                  disabled={isAdding || boxes === 0}
                  className="flex items-center gap-2 bg-foreground text-primary-foreground font-body text-sm font-medium px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isAdding ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default ProductDetail;
