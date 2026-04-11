import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Package, Leaf, ChefHat, Scissors, Box, Truck, CheckCircle2,
  MapPin, ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";

const ARTISAN_STEPS = [
  { key: "submitted", label: "Order Logged", icon: Package, description: "Your order has been received by our team." },
  { key: "confirmed", label: "Order Confirmed", icon: CheckCircle2, description: "Our team has verified your order details." },
  { key: "in_production", label: "Ingredients Sourced", icon: Leaf, description: "Premium ingredients are being prepared." },
  { key: "assembly", label: "Hand-Crafting", icon: ChefHat, description: "Our master artisans are crafting your order." },
  { key: "packing", label: "Artisan Packing", icon: Scissors, description: "Each piece is being carefully packed." },
  { key: "packed_ready", label: "Quality Checked", icon: ShieldCheck, description: "Final quality inspection complete." },
  { key: "dispatched", label: "Dispatched", icon: Box, description: "Your order is on its way!" },
  { key: "in_transit", label: "In Transit", icon: Truck, description: "En route to your location." },
  { key: "delivered", label: "Delivered", icon: MapPin, description: "Enjoy your Oasis Baklawa!" },
];

function getStepIndex(status: string): number {
  const map: Record<string, number> = {
    submitted: 0, pending: 0, draft: 0,
    confirmed: 1, approved: 1,
    in_production: 2, manufacturing: 2, processing: 2,
    assembly: 3,
    packing: 4, packed_ready: 5,
    invoice_generated: 5,
    dispatched: 6, cleared_for_dispatch: 6,
    in_transit: 7,
    delivered: 8, closed: 8, support_window: 8,
  };
  return map[status?.toLowerCase()] ?? 0;
}

interface TrackingOrder {
  order_ref: string;
  status: string;
  created_at: string;
  estimated_dispatch: string | null;
  actual_dispatch: string | null;
  tracking_number: string | null;
  courier: string | null;
  company_name: string;
  items: { name: string; quantity: number; image_url: string | null; pack_size: string | null }[];
}

const PublicOrderTracking = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [order, setOrder] = useState<TrackingOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("No tracking token provided.");
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("public-order-tracking", {
          body: null,
          method: "GET",
          headers: {},
        });
        // supabase.functions.invoke doesn't support query params well, so use fetch directly
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/public-order-tracking?token=${token}`,
          {
            headers: {
              "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );
        if (!res.ok) {
          setError("Order not found. Please check your tracking link.");
          setLoading(false);
          return;
        }
        const orderData = await res.json();
        setOrder(orderData);
      } catch (e) {
        setError("Failed to load order. Please try again.");
      }
      setLoading(false);
    };

    fetchOrder();
  }, [token]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-amber-600 mx-auto" />
          <p className="mt-4 text-amber-800 font-medium">Loading your order...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <Package size={56} className="mx-auto text-amber-300 mb-4" />
          <h1 className="text-xl font-bold text-amber-900 mb-2">Order Not Found</h1>
          <p className="text-sm text-amber-700">{error || "Please check your tracking link."}</p>
        </div>
      </div>
    );
  }

  const currentStep = getStepIndex(order.status);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-amber-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-800 to-amber-900 text-white px-6 py-8">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold tracking-wide">🧁 Oasis Baklawa</h1>
          <p className="text-amber-200 text-sm mt-1">Artisan Order Tracking</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 pb-12 space-y-5">
        {/* Order Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white rounded-2xl shadow-lg p-5 border border-amber-200"
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-amber-600 font-bold uppercase tracking-wider">Order</p>
            <p className="text-xs text-amber-600 font-medium">{formatDate(order.created_at)}</p>
          </div>
          <p className="text-2xl font-bold text-amber-900">#{order.order_ref}</p>
          <p className="text-sm text-amber-700 mt-1">{order.company_name}</p>

          {order.tracking_number && (
            <div className="mt-3 bg-amber-50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-amber-600 font-bold uppercase">Tracking</p>
              <p className="text-sm font-mono font-bold text-amber-900">
                {order.courier ? `${order.courier}: ` : ""}{order.tracking_number}
              </p>
            </div>
          )}
        </motion.div>

        {/* Timeline */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-5 border border-amber-200"
        >
          <h2 className="text-base font-bold text-amber-900 mb-5">Your Order Journey</h2>
          <div className="relative">
            {ARTISAN_STEPS.map((step, i) => {
              const isCompleted = i <= currentStep;
              const isCurrent = i === currentStep;
              const StepIcon = step.icon;

              return (
                <div key={step.key} className="flex items-start gap-4 relative">
                  {i < ARTISAN_STEPS.length - 1 && (
                    <div
                      className={`absolute left-[19px] top-[40px] w-0.5 h-[calc(100%-8px)] transition-colors ${
                        i < currentStep ? "bg-amber-500" : "bg-amber-200"
                      }`}
                    />
                  )}
                  <motion.div
                    initial={isCurrent ? { scale: 0.8 } : {}}
                    animate={isCurrent ? { scale: [0.8, 1.1, 1] } : {}}
                    transition={{ duration: 0.5 }}
                    className={`relative z-10 w-[40px] h-[40px] rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      isCompleted
                        ? "bg-amber-500 text-white shadow-md"
                        : "bg-amber-100 text-amber-300"
                    } ${isCurrent ? "ring-4 ring-amber-200" : ""}`}
                  >
                    <StepIcon size={18} />
                  </motion.div>
                  <div className={`pb-7 ${isCurrent ? "pt-0" : ""}`}>
                    <p
                      className={`text-sm font-bold ${
                        isCompleted ? "text-amber-900" : "text-amber-400"
                      }`}
                    >
                      {step.label}
                    </p>
                    {(isCurrent || isCompleted) && (
                      <p className="text-xs text-amber-600 mt-0.5">{step.description}</p>
                    )}
                    {isCurrent && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-1 inline-block text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                      >
                        Current
                      </motion.div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Items */}
        {order.items.length > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-lg p-5 border border-amber-200"
          >
            <h2 className="text-base font-bold text-amber-900 mb-3">
              Your Items ({order.items.length})
            </h2>
            <div className="space-y-3">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center overflow-hidden border border-amber-200">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="w-10 h-10 object-contain" />
                    ) : (
                      <Package size={18} className="text-amber-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-900 truncate">{item.name}</p>
                    {item.pack_size && (
                      <p className="text-[10px] text-amber-500">{item.pack_size}</p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-amber-700">×{item.quantity}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Footer */}
        <div className="text-center pt-4">
          <p className="text-xs text-amber-600">
            Questions? Contact your Sales Executive or reply on WhatsApp.
          </p>
          <p className="text-[10px] text-amber-400 mt-2">Powered by Oasis Baklawa</p>
        </div>
      </div>
    </div>
  );
};

export default PublicOrderTracking;
