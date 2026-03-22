import { ArrowRight, Lock, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProducts } from "@/hooks/useProducts";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")} / kg`;

const BestSellers = () => {
  const navigate = useNavigate();
  const { products, loading } = useProducts();
  const { isAuthenticated } = useAuth();

  // Show top 4 products
  const bestSellers = products?.slice(0, 4) || [];

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="min-w-[180px] bg-card rounded-2xl border border-border overflow-hidden flex-shrink-0">
            <Skeleton className="w-full h-[140px]" />
            <div className="p-4 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-8 w-full mt-2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1 no-scrollbar">
      {bestSellers.map((product) => (
        <div
          key={product.id}
          onClick={() => navigate(`/product/${product.id}`)}
          className="min-w-[180px] max-w-[180px] bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex-shrink-0 cursor-pointer hover:shadow-md transition-all group"
        >
          <div className="w-full h-[140px] overflow-hidden bg-slate-50 relative">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-medium bg-slate-100">
                No Image
              </div>
            )}
            <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] font-bold text-emerald-700 uppercase tracking-wider shadow-sm flex items-center gap-1">
              <TrendingUp size={10} /> Top Rated
            </div>
          </div>
          <div className="p-4 flex flex-col justify-between h-[100px]">
            <p className="font-bold text-slate-900 text-sm leading-tight line-clamp-2">{product.name}</p>
            {isAuthenticated ? (
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs font-semibold text-slate-500">{formatPrice(product.price_per_kg)}</p>
                <button className="bg-slate-900 text-white w-7 h-7 rounded-full flex items-center justify-center shadow-sm group-hover:bg-amber-500 transition-colors">
                  <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              <p className="text-[10px] font-bold text-amber-600 mt-2 flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md">
                <Lock size={10} /> Login for Price
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default BestSellers;
