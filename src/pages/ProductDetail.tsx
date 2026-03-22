import AppShell from "@/components/AppShell";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import { Heart, ShoppingCart, Loader2, ChevronLeft, ChevronRight, Package, Maximize2, X, ShieldCheck } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useCart } from "@/hooks/useCart"; 
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useProducts"; 
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const formatPrice = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

const getCartonSize = (cartonType: string | null) => {
  if (cartonType?.toLowerCase().includes("c")) return 9;
  if (cartonType?.toLowerCase().includes("b")) return 6;
  if (cartonType?.toLowerCase().includes("a")) return 4;
  return 4; 
};

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const { products } = useProducts();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [boxes, setBoxes] = useState(1); 
  const [isFav, setIsFav] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  const [activeImage, setActiveImage] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);

  const clientCategory = "Premium Distributor"; 
  const clientDiscountRate = 0.15; 

  useEffect(() => {
    if (!id) return;
    window.scrollTo(0, 0); 
    setLoading(true);
    setBoxes(1); 
    
    supabase.from("products").select("*").eq("id", id).single().then(({ data, error }) => {
      if (!error && data) setProduct(data);
      setLoading(false);
    });
  }, [id]);

  const currentIndex = products.findIndex(p => p.id === id);
  const prevProduct = currentIndex > 0 ? products[currentIndex - 1] : null;
  const nextProduct = currentIndex < products.length - 1 ? products[currentIndex + 1] : null;
  
  const relatedProducts = useMemo(() => {
    return products.filter(p => p.id !== id && p.carton_type === product?.carton_type).slice(0, 4);
  }, [products, id, product]);

  if (loading) return <AppShell><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[#B8860B]" /></div></AppShell>;
  if (!product) return <AppShell><div className="flex flex-col items-center justify-center min-h-[60vh]"><p>Product not found</p></div></AppShell>;

  const packsPerCarton = getCartonSize(product.carton_type);
  const remainder = boxes % packsPerCarton;
  const neededToFill = remainder === 0 ? 0 : packsPerCarton - remainder;
  const progressPercentage = remainder === 0 ? 100 : (remainder / packsPerCarton) * 100;

  const images = [product.image_url, product.image_url, product.image_url].filter(Boolean);

  const baseWholesalePrice = product.price_per_kg || 0;
  const mySlabPrice = baseWholesalePrice * (1 - clientDiscountRate);
  const currentTotal = boxes * mySlabPrice;

  const handleAddToCart = async () => {
    setIsAdding(true);
    const success = await addToCart(product.id, boxes, product.pack_size, product.carton_type);
    setIsAdding(false);
    if (success) {
      toast.success(`Added ${boxes} packs to your order!`, { icon: '📦' });
      setBoxes(1); // Reset stepper so they can browse the next item cleanly
    }
  };

  return (
    <AppShell>
      <div className="max-w-md mx-auto bg-slate-50 min-h-screen pb-24 shadow-sm border-x border-slate-200">
        
        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-slate-100 shadow-sm">
          <button onClick={() => navigate('/catalogue')} className="flex items-center gap-1 text-slate-700 font-bold text-sm hover:text-[#B8860B] transition-colors">
            <ChevronLeft size={20} /> Catalogue
          </button>
          <button onClick={() => setIsFav(!isFav)} className="w-9 h-9 flex items-center justify-center bg-slate-50 rounded-full border border-slate-200">
            <Heart size={18} className={isFav ? "text-rose-500 fill-rose-500" : "text-slate-400"} />
          </button>
        </div>

        <div className="w-full bg-white relative aspect-square group">
          <div className="absolute top-4 right-4 z-10">
            <button onClick={() => setShowImageModal(true)} className="w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow-sm text-slate-600 hover:text-[#B8860B]">
              <Maximize2 size={18} />
            </button>
          </div>
          <img src={images[activeImage] || "/placeholder.svg"} onClick={() => setShowImageModal(true)} alt={product.name} className="w-full h-full object-contain p-8 cursor-pointer drop-shadow-xl" />
          
          {images.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
              {images.map((_, idx) => (
                <button key={idx} onClick={() => setActiveImage(idx)} className={`h-2 rounded-full transition-all ${activeImage === idx ? 'w-6 bg-[#B8860B]' : 'w-2 bg-slate-300'}`} />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between bg-slate-900 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider">
          <button onClick={() => prevProduct && navigate(`/product/${prevProduct.id}`)} disabled={!prevProduct} className="flex items-center gap-1 hover:text-[#B8860B] disabled:opacity-30 transition-colors">
            <ChevronLeft size={16} /> Prev Product
          </button>
          <span className="text-slate-500">|</span>
          <button onClick={() => nextProduct && navigate(`/product/${nextProduct.id}`)} disabled={!nextProduct} className="flex items-center gap-1 hover:text-[#B8860B] disabled:opacity-30 transition-colors">
            Next Product <ChevronRight size={16} />
          </button>
        </div>

        <div className="bg-[#B8860B] text-white px-6 py-5 flex flex-col items-center text-center">
          <h1 className="font-display text-2xl font-bold tracking-wide">{product.name}</h1>
          <div className="flex items-center gap-2 mt-2 bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <Package size={14} /> 1 Pack = {product.pack_size || "700g"}
          </div>
        </div>

        {isAuthenticated && (
          <div className="bg-slate-900 p-5 text-white">
            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#B8860B]" />
                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Active Price Slab</p>
              </div>
              <span className="bg-[#B8860B]/20 text-[#B8860B] px-2 py-1 rounded text-[10px] font-bold uppercase border border-[#B8860B]/30">
                {clientCategory}
              </span>
            </div>
            
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-slate-400 line-through mb-0.5">Standard: {formatPrice(baseWholesalePrice)} /kg</p>
                <p className="text-2xl font-black text-white">{formatPrice(mySlabPrice)} <span className="text-xs font-bold text-[#B8860B]">/pack</span></p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">
                  You Save {(clientDiscountRate * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white mb-2">
          <div className="grid grid-cols-2 border-b border-slate-100">
            <div className="p-3 text-sm font-medium text-slate-500 border-r border-slate-100">Wt Per Pc. (Avg.)</div>
            <div className="p-3 text-sm font-bold text-slate-800 text-center">22g</div>
          </div>
          <div className="grid grid-cols-2 border-b border-slate-100 bg-slate-50/50">
            <div className="p-3 text-sm font-medium text-slate-500 border-r border-slate-100">Shelf Life</div>
            <div className="p-3 text-sm font-bold text-slate-800 text-center">{product.shelf_life || "9 Months"}</div>
          </div>
        </div>

        {/* THE ORDER ENGINE (Put back into the normal page flow!) */}
        {isAuthenticated && (
          <div className="p-5 bg-white shadow-sm border-y border-slate-100 space-y-5">
            
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-slate-500 flex items-center justify-between">
                <span>{packsPerCarton} Packs = 1 Master Carton</span>
                <span className="text-[#B8860B]">{remainder === 0 ? packsPerCarton : remainder} / {packsPerCarton}</span>
              </p>
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${progressPercentage}%` }} className={`h-full ${remainder === 0 ? 'bg-emerald-500' : 'bg-[#B8860B]'}`} />
              </div>
              <p className="text-[11px] font-bold text-center text-slate-600">
                {remainder === 0 ? "✨ Perfect! Master Carton Filled." : `Add ${neededToFill} more packs for secure carton shipping.`}
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end px-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Price</span>
                <span className="text-2xl font-black text-[#B8860B]">{formatPrice(currentTotal)}</span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-200 h-14">
                  <button onClick={() => setBoxes(b => Math.max(1, b - 1))} className="w-12 h-full rounded-lg bg-white shadow-sm font-bold text-xl active:scale-95 text-slate-700">−</button>
                  <span className="font-bold text-xl w-10 text-center text-slate-900">{boxes}</span>
                  <button onClick={() => setBoxes(b => b + 1)} className="w-12 h-full rounded-lg bg-slate-900 text-white shadow-sm font-bold text-xl active:scale-95">+</button>
                </div>
                <button onClick={handleAddToCart} disabled={isAdding} className="flex-1 h-14 rounded-xl bg-[#B8860B] text-white font-bold text-base shadow-xl flex items-center justify-center gap-2 active:scale-95 hover:bg-[#9A7009] transition-colors">
                  {isAdding ? <Loader2 size={20} className="animate-spin" /> : <ShoppingCart size={20} />} Add to Order
                </button>
              </div>
            </div>

          </div>
        )}

        {/* YOU MAY ALSO LIKE (Cross-Selling) */}
        {relatedProducts.length > 0 && (
          <div className="pt-8 pb-4 bg-white mt-2">
            <h3 className="px-5 text-lg font-display font-bold text-slate-900 mb-4">You May Also Like</h3>
            <div className="flex overflow-x-auto gap-4 px-5 pb-4 scrollbar-hide">
              {relatedProducts.map((rp) => (
                <div key={rp.id} onClick={() => navigate(`/product/${rp.id}`)} className="min-w-[140px] max-w-[140px] bg-white rounded-2xl border border-slate-200 p-3 shadow-sm flex-shrink-0 cursor-pointer active:scale-95 transition-transform">
                  <div className="w-full aspect-square bg-slate-50 rounded-xl mb-3 p-2 flex items-center justify-center">
                    {rp.image_url ? <img src={rp.image_url} alt={rp.name} className="w-full h-full object-contain" /> : <Package size={24} className="text-slate-300"/>}
                  </div>
                  <p className="font-bold text-slate-800 text-xs leading-tight line-clamp-2">{rp.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <Animate