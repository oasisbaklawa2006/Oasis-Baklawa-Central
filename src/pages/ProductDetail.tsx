import AppShell from "@/components/AppShell";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
  ShoppingCart,
  Loader2,
  ChevronLeft,
  Package,
  X,
  Plus,
  Minus,
  Info,
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
  getHsnCode,
  getPrimaryPackWeightKg,
  getBasePricePerKg,
  getBasePricePerPc,
  unitsToFillCarton,
  calculateLineGrandTotal,
} from "@/utils/pricing";

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const { formatPrice } = useCurrency();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [boxes, setBoxes] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);

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
          setBoxes(getMinOrderQty(data));
        }
        setLoading(false);
      });
  }, [id]);

  if (loading)
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-[#C4A052]" />
        </div>
      </AppShell>
    );

  if (!product)
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <p className="text-[#4A3623]/60">Product not found</p>
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
  const price = calculatePackPrice(product);
  const displayInfo = getDisplayPrice(product);
  const grandTotal = calculateLineGrandTotal(product, boxes);
  const toFill = unitsToFillCarton(product, boxes);
  const isBulk = cat === "bulk_kg";
  const dietaryTags: string[] = product.dietary_tags || [];
  const isVeg = dietaryTags.some((t: string) => t.toLowerCase().includes("veg"));
  const images = [product.image_url].filter(Boolean);

  const handleAddToCart = async () => {
    setIsAdding(true);
    const success = await addToCart(product.id, boxes, product.pack_size, product.carton_type);
    setIsAdding(false);
    if (success) {
      toast.success(`Added ${boxes} packs to your order!`, { icon: "📦" });
      setBoxes(minQty);
    }
  };

  // Spec rows
  const specRows = [
    { label: "Net Weight", value: product.net_weight_grams ? `${product.net_weight_grams}g` : null },
    { label: "Shelf Life", value: product.shelf_life || null },
    { label: "Storage", value: product.storage_type || null },
    { label: "Carton Type", value: product.carton_type || null },
    { label: "Packs / Master Carton", value: packsPerCarton ? String(packsPerCarton) : null },
    { label: "HSN Code", value: hsn || null },
  ].filter((r) => r.value);

  const [activeSlide, setActiveSlide] = useState(0);
  const heroImages = images.length > 0 ? images : ["/placeholder.svg"];

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const slideWidth = el.clientWidth;
    const idx = Math.round(el.scrollLeft / slideWidth);
    setActiveSlide(idx);
  };

  return (
    <AppShell>
      <div className="relative">
        <div className="max-w-md mx-auto bg-[#F9F8F3] min-h-screen pb-36">

          {/* Hero Image Carousel — 65vh */}
          <div className="relative w-full" style={{ height: "65vh" }}>
            <div
              className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
              onScroll={handleScroll}
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {heroImages.map((img, i) => (
                <div
                  key={i}
                  className="min-w-full h-full snap-center flex items-center justify-center p-8 bg-[#F9F8F3] cursor-pointer"
                  onClick={() => setShowImageModal(true)}
                >
                  <img
                    src={img}
                    alt={`${product.name} ${i + 1}`}
                    className="w-full h-full object-contain mix-blend-multiply"
                  />
                </div>
              ))}
            </div>

            {/* Veg badge */}
            {isVeg && (
              <div className="absolute top-4 right-4 z-10 w-7 h-7 border-2 border-[#2E7D32] rounded-sm flex items-center justify-center bg-[#F9F8F3]">
                <div className="w-3.5 h-3.5 rounded-full bg-[#2E7D32]" />
              </div>
            )}

            {/* Floating pagination dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
              {heroImages.map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${i === activeSlide ? "bg-[#C4A052]" : "bg-[#D9D5CA]"}`}
                />
              ))}
            </div>
          </div>

          {/* Gold Title Banner */}
          <div className="bg-[#C4A052] px-6 py-5 text-center">
            <h1 className="text-[#4A3623] text-xl font-light uppercase tracking-[0.2em]" style={{ fontFamily: "var(--font-body)" }}>
              {product.name}
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2 text-[#4A3623]/70 text-xs uppercase tracking-wider">
              <Package size={14} /> 1 Pack = {product.pack_size || "Standard"}
            </div>
            {product.category && (
              <p className="text-[10px] mt-2 text-[#4A3623]/60 uppercase tracking-wider">
                {product.category}{product.sub_category ? ` › ${product.sub_category}` : ""}
              </p>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="bg-[#F9F8F3] px-6 py-5 border-b border-[#C4A052]/20 text-center">
              <p className="text-sm text-[#4A3623]/70 italic leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>{product.description}</p>
            </div>
          )}

          {/* Pricing Block */}
          {isAuthenticated && (
            <div className="bg-[#F9F8F3] px-6 py-6 border-b border-[#C4A052]/20">
              {product.mrp && product.mrp > displayInfo.price && (
                <p className="text-center text-[#4A3623]/50 text-sm line-through mb-1" style={{ fontFamily: "var(--font-body)" }}>
                  MRP : {formatPrice(product.mrp)}/- PER KG
                </p>
              )}
              <p className="text-center text-[#4A3623] text-3xl font-bold mb-1" style={{ fontFamily: "var(--font-body)" }}>
                {formatPrice(displayInfo.price)}{" "}
                <span className="text-base font-normal">Per {displayInfo.unit.replace("/", "")}</span>
              </p>
              {isBulk && weightKg > 0 && (
                <p className="text-center text-[#4A3623] text-sm font-bold mt-2" style={{ fontFamily: "var(--font-body)" }}>
                  Pack Price {formatPrice(getBasePricePerKg(product))}/kg × {weightKg} kg = {formatPrice(price)}/-
                </p>
              )}
              {!isBulk && (
                <p className="text-center text-[#4A3623] text-sm font-bold mt-2" style={{ fontFamily: "var(--font-body)" }}>
                  Pack Price : {formatPrice(price)}/-
                </p>
              )}
              <p className="text-center text-[#4A3623]/40 text-[9px] uppercase tracking-widest mt-2">
                Taxes & Transportation Extra
              </p>
            </div>
          )}

          {/* Spec Table */}
          {specRows.length > 0 && (
            <div className="overflow-hidden">
              {specRows.map((row, i) => (
                <div
                  key={row.label}
                  className={`grid grid-cols-2 ${i % 2 === 0 ? "bg-[#C4A052]" : "bg-[#F9F8F3]"}`}
                >
                  <div className={`p-3.5 text-sm font-medium ${i % 2 === 0 ? "text-white" : "text-[#4A3623]"}`} style={{ fontFamily: "var(--font-body)" }}>
                    {row.label}
                  </div>
                  <div className={`p-3.5 text-sm font-bold text-right ${i % 2 === 0 ? "text-white" : "text-[#4A3623]"}`} style={{ fontFamily: "var(--font-body)" }}>
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Cross-sell — tight, no dead space */}
          <ProductRecommendations title="You may also like:" excludeProductId={id} />
        </div>

        {/* Sticky Bottom Bar */}
        {isAuthenticated && (
          <div className="fixed bottom-0 left-0 right-0 z-30">
            <div className="max-w-md mx-auto bg-[#F9F8F3] border-t-[1.5px] border-[#C4A052] px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
              {/* Carton helper */}
              {boxes > 0 && toFill > 0 && (
                <p className="text-[9px] text-[#C4A052] font-medium text-center mb-2 flex items-center justify-center gap-1">
                  <Info size={10} /> Add {toFill} more to complete a master carton
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                {/* Price */}
                <div className="flex-shrink-0">
                  <p className="text-[8px] text-[#4A3623]/50 uppercase tracking-wider leading-tight">
                    Total Price incl. GST@{gstRate}%
                  </p>
                  <p className="text-xl font-bold text-[#4A3623]">{formatPrice(grandTotal)}</p>
                </div>

                {/* Qty selector */}
                <div className="flex items-center bg-[#C4A052] rounded-full px-1 py-1 gap-0">
                  <button
                    onClick={() => setBoxes((b) => Math.max(minQty, b - increment))}
                    className="w-9 h-9 rounded-full bg-[#4A3623] text-white flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="font-bold text-lg w-10 text-center text-[#4A3623]">{boxes}</span>
                  <button
                    onClick={() => setBoxes((b) => b + increment)}
                    className="w-9 h-9 rounded-full bg-[#4A3623] text-white flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* Add to Cart */}
                <button
                  onClick={handleAddToCart}
                  disabled={isAdding}
                  className="flex items-center gap-2 bg-[#C4A052] text-[#4A3623] font-bold text-sm px-5 py-3 rounded-full shadow-md active:scale-95 hover:bg-[#C4A052]/90 transition-all disabled:opacity-50"
                >
                  {isAdding ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <ShoppingCart size={18} />
                  )}
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

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
              <img
                src={images[0]}
                alt="Zoomed"
                className="w-full max-w-lg object-contain max-h-[80vh]"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
};

export default ProductDetail;
