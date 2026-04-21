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
import { useProductVariants } from "@/hooks/useProductVariants";

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
  getPackDescription,
} from "@/utils/pricing";
import { resolveProductFamily, getDisplayScale, familyHidesWeight } from "@/lib/product-family";

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAuthenticated, priceTier } = useAuth();
  const { formatPrice } = useCurrency();
  const { variants, loading: variantsLoading } = useProductVariants(id);

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [boxes, setBoxes] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

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

  // Auto-select first variant when variants load
  useEffect(() => {
    if (variants.length > 0 && !selectedVariantId) {
      setSelectedVariantId(variants[0].id);
    }
  }, [variants, selectedVariantId]);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const hasVariants = variants.length > 0;

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
  const minQty = hasVariants && selectedVariant ? selectedVariant.moq : getMinOrderQty(product);
  const increment = getQtyIncrement(product);
  const gstRate = getGstRate(product);
  const weightKg = getPrimaryPackWeightKg(product);
  const price = hasVariants && selectedVariant ? selectedVariant.price : calculatePackPrice(product, priceTier);
  const displayInfo = hasVariants && selectedVariant
    ? { price: selectedVariant.price, unit: "/" + selectedVariant.variant_name }
    : getDisplayPrice(product, priceTier);
  const grandTotal = hasVariants && selectedVariant
    ? selectedVariant.price * boxes * (1 + gstRate / 100)
    : calculateLineGrandTotal(product, boxes, priceTier);
  const toFill = unitsToFillCarton(product, boxes);
  const isBulk = cat === "bulk_kg";
  const images = [product.image_url].filter(Boolean);
  const heroImages = images.length > 0 ? images : ["/placeholder.svg"];
  const mrp = Number(product?.mrp) || Number(product?.mrp_per_pc) || 0;
  const showMrpStrike = mrp > 0 && displayInfo.price > 0 && Math.abs(mrp - displayInfo.price) > 0.5;
  const family = resolveProductFamily(product);
  const displayScale = getDisplayScale(product);
  const weightLabel = familyHidesWeight(family)
    ? (displayScale || "1 Unit")
    : (isBulk && weightKg > 0
        ? (weightKg >= 1 ? `${weightKg} kg` : `${Math.round(weightKg * 1000)} g`)
        : (displayScale || product.pack_size || "Standard"));

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
    family === "goldware" && product.dimensions && `Size: ${product.dimensions}`,
    family === "goldware" && product.material && `Material: ${product.material}`,
    family === "hampers" && product.bom_summary && `Includes: ${product.bom_summary}`,
    family === "hampers" && product.gross_weight_kg && `Gross Weight: ${product.gross_weight_kg} kg`,
    product.shelf_life && `Shelf Life: ${product.shelf_life}`,
    product.storage_type && `Storage: ${product.storage_type}`,
    !familyHidesWeight(family) && getPacksPerCarton(product) && `Master Carton: ${getPacksPerCarton(product)} packs`,
  ].filter(Boolean);

  return (
    <AppShell>
      <div className="relative min-h-screen bg-background pb-24">

        {/* ─── Hero Image ─── */}
        <div className="relative w-full">
          <div
            className="w-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
            onScroll={handleScroll}
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {heroImages.map((img, i) => (
              <div key={i} className="min-w-full snap-center flex items-center justify-center p-4 bg-background">
                <img
                  src={img}
                  alt={`${product.name} ${i + 1}`}
                  className="w-full h-auto max-h-[50vh] object-contain"
                />
              </div>
            ))}
          </div>
          {heroImages.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
              {heroImages.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === activeSlide ? "bg-primary" : "bg-border"}`} />
              ))}
            </div>
          )}
        </div>

        {/* ─── Product Info + Order Actions (side by side on md+) ─── */}
        <div className="px-5 pt-4 md:grid md:grid-cols-[1fr_280px] md:gap-8">
          {/* LEFT: Product Info */}
          <div className="space-y-4">
            <div>
              <h1 className="font-display text-xl text-foreground leading-snug">{product.name}</h1>
              <p className="font-body text-xs text-muted-foreground mt-1">
                {product.sub_category || product.category}
              </p>
            </div>

            {product.description && (
              <p className="font-body text-sm text-muted-foreground leading-relaxed line-clamp-3">
                {product.description}
              </p>
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

          {/* RIGHT: Order Actions */}
          {isAuthenticated && (
            <div className="mt-5 md:mt-0 space-y-4 bg-card rounded-2xl p-4 border border-border" style={{ boxShadow: "var(--card-shadow)" }}>

              {/* Variant Selector */}
              {hasVariants && (
                <div>
                  <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Select Variant</p>
                  <div className="flex flex-wrap gap-2">
                    {variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => {
                          setSelectedVariantId(v.id);
                          setBoxes(0);
                        }}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                          selectedVariantId === v.id
                            ? "bg-foreground text-primary-foreground border-foreground"
                            : "bg-card text-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {v.variant_name}
                        <span className="block text-[10px] font-normal mt-0.5">{formatPrice(v.price)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Price */}
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <p className="font-number text-xl text-foreground font-semibold">
                    {formatPrice(displayInfo.price)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">{displayInfo.unit}</span>
                  </p>
                  {!hasVariants && showMrpStrike && (
                    <span className="font-number text-xs text-muted-foreground line-through">
                      MRP {formatPrice(mrp)}
                    </span>
                  )}
                </div>
                {!hasVariants && (
                  <p className="font-number text-sm text-muted-foreground">
                    Pack: {weightLabel} · {formatPrice(price)}
                  </p>
                )}
              </div>

              {/* MOQ & Pack info */}
              <p className="font-body text-[10px] text-muted-foreground">
                MOQ: {minQty} &nbsp;|&nbsp; {hasVariants && selectedVariant ? selectedVariant.variant_name : getPackDescription(product)}
              </p>

              {/* Quantity Selector */}
              <div>
                <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Quantity</p>
                <div className="flex items-center bg-muted rounded-full px-1 py-1 gap-0 w-fit">
                  <button
                    onClick={() => setBoxes((b) => {
                      if (b <= 0) return 0;
                      if (b <= minQty) return 0;
                      const next = b - increment;
                      return next < minQty ? 0 : next;
                    })}
                    className="w-9 h-9 rounded-full bg-foreground text-primary-foreground flex items-center justify-center"
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={boxes}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setBoxes(val < 0 ? 0 : val);
                    }}
                    className="font-number font-semibold text-sm w-12 text-center text-foreground bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => setBoxes((b) => (b === 0 ? minQty : b + increment))}
                    className="w-9 h-9 rounded-full bg-foreground text-primary-foreground flex items-center justify-center"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Carton helper */}
              {boxes > 0 && toFill > 0 && !hasVariants && (
                <p className="font-body text-[10px] text-primary">
                  Add {toFill} more to complete a master carton
                </p>
              )}

              {/* Total + Add to Cart */}
              {boxes > 0 && (
                <div className="pt-2 border-t border-border">
                  <p className="font-body text-[9px] text-muted-foreground uppercase tracking-wider">
                    Total incl. GST@{gstRate}%
                  </p>
                  <p className="font-number text-lg font-semibold text-foreground">{formatPrice(grandTotal)}</p>
                </div>
              )}

              <button
                onClick={handleAddToCart}
                disabled={isAdding || boxes === 0}
                className="w-full flex items-center justify-center gap-2 bg-foreground text-primary-foreground font-body text-sm font-medium px-5 py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isAdding ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
                {boxes === 0 ? "Select Quantity" : `Add ${boxes} to Cart`}
              </button>
            </div>
          )}
        </div>

        {/* ─── Recommendations ─── */}
        <div className="mt-8">
          <ProductRecommendations title="You may also like" excludeProductId={id} />
        </div>
      </div>
    </AppShell>
  );
};

export default ProductDetail;
