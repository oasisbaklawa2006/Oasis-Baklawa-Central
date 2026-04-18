import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, TrendingUp, TrendingDown, Package, ArrowRight, Zap, ShoppingCart } from "lucide-react";
import { useGrowthStage } from "@/hooks/useGrowthStage";
import { useProducts } from "@/hooks/useProducts";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { calculatePackPrice, calculateLineTax, getMinOrderQty } from "@/utils/pricing";

const GOLD = "#c58b07";

interface Props {
  open: boolean;
  onClose: () => void;
}

/* ── STAGE 1: Starter Builder ── */
const StarterBuilder = ({
  products,
  priceTier,
  onAddToCart,
}: {
  products: any[];
  priceTier: string | null;
  onAddToCart: (lines: { id: string; qty: number }[], totalInr: number) => void;
}) => {
  const bestSellers = useMemo(() => {
    const keywords = ["pyramid", "bulbul", "finger", "cashew", "baklawa", "tart"];
    return products
      .filter((p) => keywords.some((k) => p.name?.toLowerCase().includes(k)))
      .slice(0, 6);
  }, [products]);

  const tiers = [
    { name: "Basic", count: 3, color: "border-border", desc: "3 best-sellers to start" },
    { name: "Smart", count: 5, color: "border-[#c58b07]/50", desc: "5 curated SKUs + variety" },
    { name: "Premium", count: 8, color: "border-[#c58b07]", desc: "Full range starter kit" },
  ];

  const [selectedTier, setSelectedTier] = useState(1);
  const tierProducts = bestSellers.slice(0, tiers[selectedTier].count);

  // Build lines using SAME math as cart so Grand Total === Estimated Investment.
  const lines = useMemo(
    () =>
      tierProducts.map((p) => {
        const qty = getMinOrderQty(p);
        const subtotal = calculatePackPrice(p, priceTier) * qty;
        const tax = calculateLineTax(p, qty, priceTier);
        return { product: p, qty, lineTotal: Math.round(subtotal + tax) };
      }),
    [tierProducts, priceTier]
  );

  const totalInvestment = lines.reduce((s, l) => s + l.lineTotal, 0);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-foreground mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
          Starter Pack Builder
        </h3>
        <p className="text-xs text-muted-foreground">Choose your tier — first-order MOQ relaxation applied automatically</p>
      </div>

      {/* Tier selector */}
      <div className="grid grid-cols-3 gap-2">
        {tiers.map((tier, i) => (
          <button
            key={tier.name}
            onClick={() => setSelectedTier(i)}
            className={`p-3 rounded-xl border-2 text-center transition-all ${
              selectedTier === i ? `${tier.color} bg-card shadow-md scale-[1.02]` : "border-border bg-muted/30"
            }`}
          >
            <span className="text-xs font-bold text-foreground block">{tier.name}</span>
            <span className="text-[10px] text-muted-foreground">{tier.desc}</span>
          </button>
        ))}
      </div>

      {/* Product list */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {lines.map((l) => (
          <div key={l.product.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 border border-border">
            <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden shrink-0">
              {l.product.image_url && <img src={l.product.image_url} className="w-full h-full object-cover" alt="" loading="lazy" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{l.product.name}</p>
              <p className="text-[10px] text-muted-foreground">{l.product.category} • MOQ {l.qty}</p>
            </div>
            <span className="text-xs font-bold" style={{ color: GOLD }}>
              ₹{l.lineTotal.toLocaleString("en-IN")}
            </span>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between p-4 rounded-xl border-2" style={{ borderColor: GOLD, background: `${GOLD}08` }}>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Estimated Investment (incl. tax)</p>
          <p className="text-lg font-bold" style={{ color: GOLD, fontFamily: "'DM Sans', sans-serif" }}>
            ₹{totalInvestment.toLocaleString("en-IN")}
          </p>
        </div>
        <button
          onClick={() => onAddToCart(lines.map((l) => ({ id: l.product.id, qty: l.qty })), totalInvestment)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${GOLD}, #d4a843)` }}
        >
          <ShoppingCart size={14} /> Add to Cart
        </button>
      </div>

      <p className="text-[10px] text-center text-muted-foreground italic">
        🎁 First-order Starter MOQ exception: carton-fill checks are waived
      </p>
    </div>
  );
};

/* ── STAGE 2: Reorder & Expansion ── */
const ReorderExpansion = ({
  orderedCategories,
  orderedProductIds,
  products,
  onAddToCart,
}: {
  orderedCategories: string[];
  orderedProductIds: string[];
  products: any[];
  onAddToCart: (ids: string[]) => void;
}) => {
  const allCategories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))], [products]);
  const gapCategories = allCategories.filter((c) => !orderedCategories.includes(c));

  const suggestions = useMemo(() => {
    return products
      .filter((p) => !orderedProductIds.includes(p.id) && gapCategories.includes(p.category))
      .slice(0, 3);
  }, [products, orderedProductIds, gapCategories]);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-foreground mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
          Expand Your Range
        </h3>
        <p className="text-xs text-muted-foreground">Categories you haven't explored yet — high demand from similar buyers</p>
      </div>

      {/* Gap detection */}
      {gapCategories.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Untapped Categories</p>
          <div className="flex flex-wrap gap-2">
            {gapCategories.slice(0, 5).map((cat) => (
              <span key={cat} className="px-3 py-1.5 rounded-full text-[10px] font-semibold border bg-card" style={{ borderColor: `${GOLD}40`, color: GOLD }}>
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suggested SKUs */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Recommended SKUs</p>
          {suggestions.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
              <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden shrink-0">
                {p.image_url && <img src={p.image_url} className="w-full h-full object-cover" alt="" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">{p.category}</p>
              </div>
              <span className="text-xs font-bold" style={{ color: GOLD }}>₹{(p.price_b2b || p.base_price || 0).toLocaleString()}</span>
            </div>
          ))}
          <button
            onClick={() => onAddToCart(suggestions.map((s) => s.id))}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2"
            style={{ background: `linear-gradient(135deg, ${GOLD}, #d4a843)` }}
          >
            <Zap size={14} /> Auto-fill MOQ & Add All
          </button>
        </div>
      )}

      {gapCategories.length === 0 && (
        <div className="text-center py-8">
          <Sparkles size={28} className="mx-auto mb-2" style={{ color: GOLD }} />
          <p className="text-sm font-semibold text-foreground">You're covering all categories!</p>
          <p className="text-xs text-muted-foreground">Keep optimizing quantities for maximum margins</p>
        </div>
      )}
    </div>
  );
};

/* ── STAGE 3: Growth Insights ── */
const GrowthInsights = ({
  productFrequency,
  products,
}: {
  productFrequency: Record<string, number>;
  products: any[];
}) => {
  const sorted = useMemo(() => {
    return Object.entries(productFrequency)
      .map(([id, qty]) => ({ id, qty, product: products.find((p) => p.id === id) }))
      .filter((e) => e.product)
      .sort((a, b) => b.qty - a.qty);
  }, [productFrequency, products]);

  const topSelling = sorted.slice(0, 5);
  const slowMoving = sorted.slice(-3).reverse();
  const maxQty = topSelling[0]?.qty ?? 1;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-foreground mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
          Growth Insights
        </h3>
        <p className="text-xs text-muted-foreground">Your ordering performance across {sorted.length} SKUs</p>
      </div>

      {/* Top sellers */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: GOLD }}>
          <TrendingUp size={12} /> Top Performing
        </p>
        {topSelling.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted overflow-hidden shrink-0">
              {item.product?.image_url && <img src={item.product.image_url} className="w-full h-full object-cover" alt="" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{item.product?.name}</p>
              <div className="w-full h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(item.qty / maxQty) * 100}%`, background: GOLD }} />
              </div>
            </div>
            <span className="text-xs font-bold text-foreground shrink-0" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {item.qty} units
            </span>
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground italic">💡 Consider increasing order quantities for these high-performers</p>
      </div>

      {/* Slow movers */}
      {slowMoving.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 text-muted-foreground">
            <TrendingDown size={12} /> Slow Moving
          </p>
          {slowMoving.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground flex-1 truncate">{item.product?.name}</p>
              <span className="text-[10px] text-muted-foreground">{item.qty} units</span>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground italic">Consider replacing with premium gift items for better margins</p>
        </div>
      )}
    </div>
  );
};

/* ── Main Modal ── */
const GrowthIntelligenceModal = ({ open, onClose }: Props) => {
  const { stage, orderCount, loading, orderedCategories, orderedProductIds, productFrequency } = useGrowthStage();
  const { products } = useProducts();
  const { addToCart } = useCart();
  const { priceTier } = useAuth();
  const navigate = useNavigate();

  // Starter Pack flow: marks the draft order as is_starter_pack so cart waives MOQ.
  const handleAddStarterPack = async (lines: { id: string; qty: number }[], _totalInr: number) => {
    let count = 0;
    for (const l of lines) {
      const ok = await addToCart(l.id, l.qty, null, null, { isStarterPack: true });
      if (ok) count++;
    }
    toast.success(`Starter Pack added — ${count} items, MOQ waived`);
    onClose();
    navigate("/cart");
  };

  // Reorder/expansion uses normal flow (full MOQ enforcement).
  const handleAddReorder = async (ids: string[]) => {
    for (const id of ids) {
      const product = products.find((p) => p.id === id);
      const qty = product ? getMinOrderQty(product) : 5;
      await addToCart(id, qty);
    }
    toast.success(`${ids.length} items added to cart`);
    onClose();
    navigate("/cart");
  };

  const stageLabel = stage === "new" ? "Starter" : stage === "growth" ? "Growth" : "Advanced";
  const stageIcon = stage === "new" ? "🌱" : stage === "growth" ? "📈" : "🏆";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
          style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[85vh] bg-card rounded-t-2xl sm:rounded-2xl border border-border overflow-hidden flex flex-col"
            style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.15)" }}
          >
            {/* Header */}
            <div className="p-5 border-b border-border flex items-center gap-3">
              <span className="text-2xl">{stageIcon}</span>
              <div className="flex-1">
                <h2 className="text-base font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Growth Intelligence
                </h2>
                <p className="text-[10px] text-muted-foreground">
                  Stage: <span className="font-bold" style={{ color: GOLD }}>{stageLabel}</span> • {orderCount} orders placed
                </p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X size={16} className="text-muted-foreground" /></button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${GOLD} transparent` }} />
                </div>
              ) : stage === "new" ? (
                <StarterBuilder products={products} priceTier={priceTier} onAddToCart={handleAddStarterPack} />
              ) : stage === "growth" ? (
                <ReorderExpansion
                  orderedCategories={orderedCategories}
                  orderedProductIds={orderedProductIds}
                  products={products}
                  onAddToCart={handleAddReorder}
                />
              ) : (
                <GrowthInsights productFrequency={productFrequency} products={products} />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GrowthIntelligenceModal;
