import AppShell from "@/components/AppShell";
import {
  Heart,
  ShoppingCart,
  Loader2,
  Lock,
  Package,
  ChevronRight,
  X,
  Info,
  Clock,
  Box,
  ShieldCheck,
  TrendingUp,
  Minus,
  Plus,
  Image as ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProducts } from "@/hooks/useProducts";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

import posterSpread from "@/assets/poster-spread.jpg";
import posterKunafa from "@/assets/poster-kunafa.jpg";
import posterSlice from "@/assets/poster-baklawa-slice.jpg";

// Extended B2B Product Interface
interface Product {
  id: string;
  name: string;
  sku?: string | null;
  category?: string | null;
  price_per_kg?: number | null;
  pack_size?: string | null;
  carton_type?: string | null;
  storage_type?: string | null;
  description?: string | null;
  shelf_life?: string | null;
  image_url?: string | null;
  is_active: boolean;

  // New B2B Fields
  mrp?: number | null;
  wholesale_price?: number | null;
  weight_per_pc_grams?: number | null;
  net_weight_grams?: number | null;
  moq?: number | null;
  packs_per_master_carton?: number | null;
  hsn_code?: string | null;
  dietary_tags?: string[] | null;
}

const favorites = [
  { name: "Assorted Baklawa", price: "₹5,200 / kg", image: posterSpread },
  { name: "Stuffed Dates", price: "₹3,600 / kg", image: posterKunafa },
  { name: "Pistachio Baklawa", price: "₹4,500 / kg", image: posterSlice },
];

const mainCategories = [
  { name: "Wholesale Loose Products", image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=80" },
  {
    name: "Raw / Unfinished Products",
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80",
  },
  { name: "Pre Packed Products", image: "https://images.unsplash.com/photo-1548848221-0c2e497ed557?w=600&q=80" },
  { name: "Gift Articles", image: "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=600&q=80" },
  { name: "Packaging Supplies", image: "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=600&q=80" },
];

const subCategories = ["Baklawa", "Fusion Sweets", "Chocolates", "Dates", "Dragees & Nuts", "Cookies"];

const formatPrice = (price: number) => `₹${Math.round(price).toLocaleString("en-IN")}`;

// Helper for Retail Margin Calculation
const calculateMargin = (mrp?: number | null, wholesale?: number | null) => {
  if (!mrp || !wholesale || mrp <= wholesale) return null;
  const profit = mrp - wholesale;
  const margin = Math.round((profit / mrp) * 100);
  return { profit, margin };
};

// --- B2B PRODUCT CARD ---
const ProductCard = ({ product, onOpenModal }: { product: Product; onOpenModal: (p: Product) => void }) => {
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();

  // Enforce MOQ on the card level
  const minQty = product.moq && product.moq > 0 ? product.moq : 1;
  const [boxes, setBoxes] = useState(minQty);
  const [isAdding, setIsAdding] = useState(false);

  const baseWholesalePrice = product.wholesale_price || product.price_per_kg || 0;
  const clientDiscountRate = 0.15;
  const mySlabPrice = baseWholesalePrice * (1 - clientDiscountRate);
  const currentTotal = boxes * mySlabPrice;

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (boxes < minQty) {
      toast.error(`Minimum Order Quantity is ${minQty} packs.`);
      return;
    }
    setIsAdding(true);
    const success = await addToCart(product.id, boxes, product.pack_size || "", product.carton_type || "");
    setIsAdding(false);
    if (success) {
      toast.success(`Added ${boxes} packs to your order!`, { icon: "📦" });
      setBoxes(minQty); // Reset back to MOQ
    }
  };

  return (
    <div
      onClick={() => onOpenModal(product)}
      className="bg-white rounded-2xl overflow-hidden relative group cursor-pointer transition-all duration-300 shadow-sm border border-slate-100 hover:shadow-md flex flex-col h-full"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          toast.success("Added to favorites!");
        }}
        className="absolute top-2 right-2 w-7 h-7 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow-sm text-slate-300 hover:text-rose-500 transition-colors z-10"
      >
        <Heart size={14} />
      </button>

      {/* MOQ Badge */}
      {minQty > 1 && (
        <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-sm z-10">
          MOQ: {minQty}
        </div>
      )}

      <div className="w-full aspect-square bg-slate-50/50 flex items-center justify-center p-4">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500 mix-blend-multiply"
          />
        ) : (
          <div className="text-slate-300 font-medium text-xs">
            <ImageIcon size={32} />
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1 bg-white">
        <h3 className="font-display text-[13px] font-bold text-slate-900 leading-tight mb-1 truncate group-hover:text-[#B8860B] transition-colors">
          {product.name}
        </h3>

        {isAuthenticated ? (
          <div className="flex flex-col flex-1">
            <p className="text-[9px] text-slate-500 font-medium mb-1.5 flex items-center justify-between">
              <span>
                {product.pack_size || "Standard"} • {product.net_weight_grams ? `${product.net_weight_grams}g` : "N/A"}
              </span>
            </p>

            <div className="flex justify-between items-end mb-2">
              <div>
                {product.mrp && product.mrp > baseWholesalePrice && (
                  <p className="text-[9px] text-slate-400 line-through leading-none mb-0.5">
                    MRP {formatPrice(product.mrp)}
                  </p>
                )}
                <p className="text-[13px] font-black text-slate-900 leading-none">
                  {formatPrice(mySlabPrice)} <span className="text-[8px] font-bold text-slate-500">/pack</span>
                </p>
              </div>
              <span className="text-[8px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100 uppercase tracking-wider">
                -{clientDiscountRate * 100}% Slab
              </span>
            </div>

            <div className="mt-auto flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center px-1.5 bg-slate-50 rounded py-1">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Total</span>
                <span className="text-[10px] font-black text-[#B8860B]">{formatPrice(currentTotal)}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 flex-1 h-8">
                  <button
                    onClick={() => setBoxes((b) => Math.max(minQty, b - 1))}
                    disabled={boxes <= minQty}
                    className="w-7 h-full flex items-center justify-center text-slate-500 font-bold active:bg-slate-200 rounded-l-lg disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="font-bold text-[11px] flex-1 text-center text-slate-900">{boxes}</span>
                  <button
                    onClick={() => setBoxes((b) => b + 1)}
                    className="w-7 h-full flex items-center justify-center text-slate-700 font-bold active:bg-slate-200 rounded-r-lg"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={handleAdd}
                  disabled={isAdding}
                  className="w-8 h-8 rounded-lg bg-[#B8860B] text-white flex items-center justify-center shadow-sm active:scale-95 hover:bg-[#9A7009] transition-colors flex-shrink-0 disabled:opacity-50"
                >
                  {isAdding ? <Loader2 size={12} className="animate-spin" /> : <ShoppingCart size={12} />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-auto pt-2 flex flex-col justify-end flex-1">
            <p className="text-[9px] text-slate-500 flex items-center gap-1 mb-2 font-medium">
              <Lock size={8} /> Members Only
            </p>
            <button className="w-full py-2 rounded-lg bg-slate-100 text-slate-700 font-bold text-[10px] hover:bg-slate-200 transition-colors">
              Login to View
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// --- MAIN CATALOGUE COMPONENT ---
const Catalogue = () => {
  const [activeSub, setActiveSub] = useState("Baklawa");
  const navigate = useNavigate();
  const { products, loading: productsLoading } = useProducts();
  const { items, addToCart, loading: cartLoading } = useCart();
  const { isAuthenticated } = useAuth();

  // B2B Modal State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalQty, setModalQty] = useState<number>(1);
  const [isModalAdding, setIsModalAdding] = useState(false);

  const cartSubtotal = items.reduce((sum, item) => sum + item.quantity * (item.product?.price_per_kg || 0), 0);
  const cartTax = Math.round(cartSubtotal * 0.05);
  const cartGrandTotal = cartSubtotal + cartTax;
  const cartTotalPacks = items.reduce((s, it) => s + it.quantity, 0);

  const handleOpenModal = (product: Product) => {
    setSelectedProduct(product);
    setModalQty(product.moq && product.moq > 0 ? product.moq : 1);
  };

  const handleModalAddToCart = async () => {
    if (!selectedProduct) return;
    const minQty = selectedProduct.moq || 1;
    if (modalQty < minQty) {
      toast.error(`Minimum Order Quantity is ${minQty} packs.`);
      return;
    }
    setIsModalAdding(true);
    const success = await addToCart(
      selectedProduct.id,
      modalQty,
      selectedProduct.pack_size || "",
      selectedProduct.carton_type || "",
    );
    setIsModalAdding(false);
    if (success) {
      toast.success(`Added ${modalQty}x ${selectedProduct.name} to batch!`, { icon: "🛒" });
      setSelectedProduct(null);
    }
  };

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6 pb-32">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-display-h1 text-slate-900 font-bold"
        >
          Catalogue
        </motion.h1>

        {/* Favorites Carousel */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h2 className="text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-3 flex items-center gap-1.5">
            <span className="text-[#B8860B]">⭐</span> Favorites
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {favorites.map((item, i) => (
                <div key={i} className="min-w-[130px] max-w-[130px] flex-shrink-0">
                  <div className="h-[90px] rounded-xl overflow-hidden mb-2">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <p className="font-bold text-slate-900 text-xs leading-tight truncate">{item.name}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Main Categories Grid */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h2 className="text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-3">Categories</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {mainCategories.map((cat, i) => (
              <button
                key={i}
                className="relative rounded-xl overflow-hidden shadow-sm border border-slate-100 aspect-[4/3] group"
              >
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2.5 text-left">
                  <p className="font-bold text-white text-[10px] leading-tight">{cat.name}</p>
                </div>
              </button>
            ))}
          </div>
        </motion.section>

        {/* Subcategories Scroll */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {subCategories.map((sub) => (
              <button
                key={sub}
                onClick={() => setActiveSub(sub)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-[11px] font-bold transition-all shadow-sm ${activeSub === sub ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-100 hover:border-slate-300"}`}
              >
                {sub}
              </button>
            ))}
          </div>
        </motion.section>

        {/* Product Grid */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <h2 className="text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-3">Wholesale Products</h2>
          {productsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden p-3">
                  <Skeleton className="w-full aspect-square rounded-xl" />
                  <div className="space-y-2 mt-3">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-8 w-full mt-3 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="text-sm font-medium text-slate-500 text-center py-10">No products found.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 items-stretch">
              {products.map((product) => (
                <ProductCard key={product.id} product={product as Product} onOpenModal={handleOpenModal} />
              ))}
            </div>
          )}
        </motion.section>
      </div>

      {/* Sticky Mini Cart */}
      <AnimatePresence>
        {items.length > 0 && !cartLoading && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-[80px] md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-[350px] z-40"
          >
            <div className="bg-slate-900 rounded-[1.25rem] shadow-2xl p-3.5 flex items-center justify-between border border-white/10">
              <div className="flex flex-col">
                <p className="text-white/60 text-[9px] font-bold uppercase tracking-widest mb-0.5">Your Order</p>
                <div className="flex items-center gap-2">
                  <span className="bg-[#B8860B] text-white text-[9px] font-black px-1.5 py-0.5 rounded-sm">
                    {cartTotalPacks} Packs
                  </span>
                  <p className="text-white font-black text-base leading-none">{formatPrice(cartGrandTotal)}</p>
                </div>
              </div>
              <button
                onClick={() => navigate("/cart")}
                className="bg-white text-slate-900 px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-slate-100 active:scale-95 transition-all shadow-lg shadow-white/10"
              >
                Review <ChevronRight size={14} className="-ml-0.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* B2B QUICK VIEW MODAL */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
            >
              {/* Left: Image & Tags */}
              <div className="md:w-2/5 bg-slate-100 relative shrink-0">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-4 left-4 w-8 h-8 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-slate-600 hover:bg-white md:hidden z-10 shadow-sm"
                >
                  <X size={18} />
                </button>
                {selectedProduct.image_url ? (
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="w-full h-64 md:h-full object-cover mix-blend-multiply"
                  />
                ) : (
                  <div className="w-full h-64 md:h-full flex items-center justify-center">
                    <ImageIcon size={64} className="text-slate-300" />
                  </div>
                )}

                {selectedProduct.dietary_tags && selectedProduct.dietary_tags.length > 0 && (
                  <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
                    {selectedProduct.dietary_tags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-emerald-500/90 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: B2B Spec Sheet */}
              <div className="md:w-3/5 flex flex-col max-h-full overflow-y-auto">
                <div className="p-6 md:p-8 flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-[10px] font-black text-[#B8860B] uppercase tracking-widest mb-1">
                        {selectedProduct.category || "Wholesale"}
                      </p>
                      <h2 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
                        {selectedProduct.name}
                      </h2>
                      <p className="text-xs font-mono font-bold text-slate-400 mt-1">
                        SKU: {selectedProduct.sku || "Auto-Gen"}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedProduct(null)}
                      className="hidden md:flex w-8 h-8 bg-slate-100 rounded-full items-center justify-center text-slate-500 hover:bg-slate-200"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {selectedProduct.description && (
                    <p className="text-sm font-medium text-slate-600 mt-4 leading-relaxed">
                      {selectedProduct.description}
                    </p>
                  )}

                  {/* B2B Margin Calculator Card */}
                  <div className="mt-6 bg-slate-50 border border-slate-200 rounded-2xl p-5">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Your B2B Price
                        </p>
                        <div className="flex items-end gap-2">
                          <p className="text-3xl font-black text-[#B8860B]">
                            ₹{selectedProduct.wholesale_price || selectedProduct.price_per_kg || 0}
                          </p>
                          <p className="text-sm font-bold text-slate-500 mb-1">/ pack</p>
                        </div>
                      </div>

                      {selectedProduct.mrp && (selectedProduct.wholesale_price || selectedProduct.price_per_kg) && (
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-400 line-through mb-1">
                            Retail MRP: ₹{selectedProduct.mrp}
                          </p>
                          {calculateMargin(
                            selectedProduct.mrp,
                            selectedProduct.wholesale_price || selectedProduct.price_per_kg,
                          ) && (
                            <div className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md flex items-center gap-1">
                              <TrendingUp size={12} />{" "}
                              {
                                calculateMargin(
                                  selectedProduct.mrp,
                                  selectedProduct.wholesale_price || selectedProduct.price_per_kg,
                                )?.margin
                              }
                              % Retail Margin
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Spec Grid */}
                  <div className="mt-6 grid grid-cols-2 gap-y-4 gap-x-6">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                        <Box size={12} /> Pack Specs
                      </p>
                      <p className="text-sm font-bold text-slate-900">{selectedProduct.pack_size || "Standard"}</p>
                      {selectedProduct.net_weight_grams && (
                        <p className="text-xs text-slate-500">{selectedProduct.net_weight_grams}g Net Wt</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                        <Package size={12} /> Master Carton
                      </p>
                      <p className="text-sm font-bold text-slate-900">
                        {selectedProduct.carton_type || "Standard Box"}
                      </p>
                      {selectedProduct.packs_per_master_carton && (
                        <p className="text-xs text-slate-500">
                          {selectedProduct.packs_per_master_carton} Packs per Box
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                        <Clock size={12} /> Shelf Life
                      </p>
                      <p className="text-sm font-bold text-slate-900">{selectedProduct.shelf_life || "N/A"}</p>
                      {selectedProduct.storage_type && (
                        <p className="text-xs text-slate-500 capitalize">{selectedProduct.storage_type}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                        <ShieldCheck size={12} /> Tax Code
                      </p>
                      <p className="text-sm font-bold text-slate-900">HSN: {selectedProduct.hsn_code || "19059090"}</p>
                    </div>
                  </div>
                </div>

                {/* Sticky Order Footer */}
                {isAuthenticated ? (
                  <div className="p-6 md:p-8 border-t border-slate-100 bg-white sticky bottom-0">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {/* Qty Selector */}
                      <div className="w-full sm:w-auto">
                        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-1 h-14">
                          <button
                            onClick={() => setModalQty(Math.max(selectedProduct.moq || 1, modalQty - 1))}
                            disabled={modalQty <= (selectedProduct.moq || 1)}
                            className="w-12 h-full flex items-center justify-center text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-30 transition-colors"
                          >
                            <Minus size={18} />
                          </button>
                          <div className="px-6 text-center">
                            <p className="font-black text-xl text-slate-900 tabular-nums">{modalQty}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Packs</p>
                          </div>
                          <button
                            onClick={() => setModalQty(modalQty + 1)}
                            className="w-12 h-full flex items-center justify-center text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                        {selectedProduct.moq && selectedProduct.moq > 1 && (
                          <p className="text-[10px] font-bold text-amber-600 mt-2 text-center flex items-center justify-center gap-1">
                            <Info size={12} /> Requires Minimum {selectedProduct.moq} Packs
                          </p>
                        )}
                      </div>

                      {/* Add to Batch Btn */}
                      <button
                        onClick={handleModalAddToCart}
                        disabled={isModalAdding}
                        className="flex-1 w-full h-14 bg-slate-900 text-white font-black uppercase tracking-widest text-sm rounded-xl shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                      >
                        {isModalAdding ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <>
                            <ShoppingCart size={18} /> Add to Batch
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 border-t border-slate-100 bg-slate-50 text-center">
                    <p className="text-sm font-bold text-slate-600 mb-3">
                      You must be logged in to view pricing and place wholesale orders.
                    </p>
                    <button
                      onClick={() => navigate("/login")}
                      className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black"
                    >
                      Login to Portal
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
};

export default Catalogue;
