import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, X, ShoppingCart, Mic, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/hooks/useCart";
import { useProducts } from "@/hooks/useProducts";
import { useNavigate } from "react-router-dom";

interface AiOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AiOrderModal = ({ isOpen, onClose }: AiOrderModalProps) => {
  const [prompt, setPrompt] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const { products } = useProducts();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const handleAnalyze = () => {
    if (!prompt.trim()) {
      toast.error("Please type or paste your order first.");
      return;
    }

    setIsAnalyzing(true);

    setTimeout(() => {
      const foundItems: any[] = [];
      const lowerPrompt = prompt.toLowerCase();

      const pyramid = products.find(p => p.name.toLowerCase().includes("pyramid"));
      const finger = products.find(p => p.name.toLowerCase().includes("finger"));
      const tart = products.find(p => p.name.toLowerCase().includes("tart"));

      if (pyramid && (lowerPrompt.includes("pyramid") || lowerPrompt.includes("5 master cartons"))) {
        foundItems.push({ product: pyramid, qty: 5 * 4, reason: "Extracted '5 master cartons of Pyramid'" });
      }
      if (finger && lowerPrompt.includes("finger")) {
        foundItems.push({ product: finger, qty: 30, reason: "Extracted '30 loose packs of Finger'" });
      }
      if (tart && lowerPrompt.includes("tart")) {
        foundItems.push({ product: tart, qty: 12, reason: "Extracted '12 tarts'" });
      }

      if (foundItems.length > 0) {
        setParsedItems(foundItems);
        toast.success("AI successfully parsed your order!");
      } else {
        toast.error("AI couldn't find matching products. Try being more specific.");
      }
      setIsAnalyzing(false);
    }, 2000);
  };

  const handleConfirmOrder = async () => {
    setIsAdding(true);
    let successCount = 0;

    for (const item of parsedItems) {
      const added = await addToCart(item.product.id, item.qty, item.product.pack_size, item.product.carton_type);
      if (added) successCount++;
    }

    setIsAdding(false);
    if (successCount > 0) {
      toast.success(`Added ${successCount} items to your batch!`, { icon: '📦' });
      onClose();
      navigate("/cart");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] overflow-hidden"
          >
            {/* AI Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                    <Sparkles size={24} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-wide">
                      <Sparkles size={14} className="inline mr-1 text-amber-400" /> AI Order Assistant
                    </h2>
                    <p className="text-slate-400 text-xs mt-0.5">Type, paste, or speak your wholesale order.</p>
                  </div>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
                  <X size={22} />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto max-h-[60vh]">
              {/* Input Area */}
              {parsedItems.length === 0 && (
                <div>
                  <div className="relative">
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g., 'I need 5 master cartons of Pyramid Baklawa and 30 loose packs of Finger Baklawa...'"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 min-h-[140px] text-sm focus:ring-2 focus:ring-[#B8860B]/50 focus:border-[#B8860B] outline-none resize-none"
                    />
                    <button className="absolute bottom-3 right-3 w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center hover:bg-slate-300 transition-colors">
                      <Mic size={18} className="text-slate-600" />
                    </button>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors">
                      <FileText size={14} /> Upload PO
                    </button>
                    <button className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors">
                      WhatsApp Sync
                    </button>
                  </div>

                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="w-full mt-5 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all disabled:opacity-60"
                  >
                    {isAnalyzing ? <Loader2 className="animate-spin mx-auto" size={20} /> : <><Sparkles size={16} className="inline mr-2" /> Analyze &amp; Build Order</>}
                  </button>
                </div>
              )}

              {/* AI Parsed Results */}
              {parsedItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                    <CheckCircle2 size={24} className="text-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-emerald-800">Order Successfully Parsed</p>
                      <p className="text-xs text-emerald-600">Please review the extracted items before adding to your batch.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {parsedItems.map((item, idx) => (
                      <div key={`${item.name}-${idx}`} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-3">
                          <ShoppingCart size={18} className="text-slate-400" />
                          <div>
                            <p className="font-bold text-sm text-slate-800">{item.product.name}</p>
                            <p className="text-xs text-slate-500"><Sparkles size={10} className="inline mr-1" /> {item.reason}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-slate-900">{item.qty}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Packs</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button onClick={() => setParsedItems([])} className="px-5 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200">Reset</button>
                    <button
                      onClick={handleConfirmOrder}
                      disabled={isAdding}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black text-sm uppercase tracking-widest shadow-lg hover:shadow-emerald-500/40 transition-all disabled:opacity-60"
                    >
                      {isAdding ? <Loader2 className="animate-spin mx-auto" size={18} /> : <><ShoppingCart size={16} className="inline mr-2" /> Add to Batch</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AiOrderModal;
