import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Package, Clock, CheckCircle2, ChevronRight, X, Image as ImageIcon, Minus, Plus, AlertTriangle, Hash, Store, Factory } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import TopNavBar from "@/components/TopNavBar";

const DEPARTMENTS = ["Baklawa", "Chocolate", "Laddu", "Bakery", "Hampers"];

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  category: string;
  quantity_ordered: number;
  image_url?: string;
}

interface OperationOrder {
  id: string;
  status: string;
  batch_id: string;
  created_at: string;
  items: OrderItem[];
}

interface Product {
  id: string;
  name: string;
  category: string;
  image_url?: string;
}

const OperationsController = () => {
  const [loading, setLoading] = useState(true);
  
  // Department Lock State
  const [myDepartment, setMyDepartment] = useState("Baklawa");
  const [activeTab, setActiveTab] = useState<"tasks" | "store_log">("tasks");
  
  const [orders, setOrders] = useState<OperationOrder[]>([]);
  const [departmentProducts, setDepartmentProducts] = useState<Product[]>([]);
  
  // Modal States
  const [activeOrder, setActiveOrder] = useState<OperationOrder | null>(null);
  const [packData, setPackData] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Direct to Store State
  const [storeLogData, setStoreLogData] = useState<Record<string, number>>({});

  const fetchData = async () => {
    setLoading(true);
    
    // 1. Fetch Orders 
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("id, status, created_at, order_items(id, quantity, product_id, product:products(name, category, image_url))")
      .in("status", ["in_production", "assembly"])
      .order("created_at", { ascending: true });

    if (!orderError && orderData) {
      const formattedOrders: OperationOrder[] = orderData.map((o: any) => ({
        id: o.id,
        status: o.status,
        batch_id: `BATCH-${o.id.split('-')[0].toUpperCase()}`,
        created_at: o.created_at,
        items: o.order_items.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product?.name || "Unknown Product",
          category: item.product?.category || "Uncategorized",
          quantity_ordered: item.quantity,
          image_url: item.product?.image_url,
        }))
      }));
      setOrders(formattedOrders);
    }

    // 2. Fetch Products for Store Logging
    const { data: prodData } = await supabase.from("products").select("id, name, category, image_url");
    if (prodData) {
      const mappedProducts: Product[] = prodData.map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category || "Uncategorized",
        image_url: p.image_url
      }));
      setDepartmentProducts(mappedProducts);

      const initialStoreData: Record<string, number> = {};
      mappedProducts.forEach(p => { initialStoreData[p.id] = 0; });
      setStoreLogData(initialStoreData);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filtering Logic
  const myDepartmentOrders = orders.filter(order => 
    order.items.some(item => item.category === myDepartment)
  );

  const myDepartmentProducts = departmentProducts.filter(p => p.category === myDepartment);

  const openPackingScreen = (order: OperationOrder) => {
    const initialPack: Record<string, number> = {};
    order.items
      .filter(item => item.category === myDepartment)
      .forEach(item => { initialPack[item.id] = 0; });
    
    setPackData(initialPack);
    setActiveOrder(order);
  };

  const adjustPack = (itemId: string, delta: number) => {
    setPackData(prev => ({ ...prev, [itemId]: Math.max(0, (prev[itemId] || 0) + delta) }));
  };

  const adjustStoreLog = (productId: string, delta: number) => {
    setStoreLogData(prev => ({ ...prev, [productId]: Math.max(0, (prev[productId] || 0) + delta) }));
  };

  const handleProcessOrder = async () => {
    if (!activeOrder) return;
    setIsSubmitting(true);

    let isPartial = false;
    let extraToStore = 0;

    activeOrder.items
      .filter(item => item.category === myDepartment)
      .forEach(item => {
        const produced = packData[item.id] || 0;
        if (produced < item.quantity_ordered) isPartial = true;
        if (produced > item.quantity_ordered) extraToStore += (produced - item.quantity_ordered);
      });

    setTimeout(async () => {
      if (isPartial) {
        toast.warning(`${activeOrder.batch_id}: Partial Fulfillment Logged.`, { icon: "⚠️" });
      } else {
        const targetStatus = activeOrder.status === "in_production" ? "assembly" : "packed_ready";
        await supabase.from("orders").update({ status: targetStatus }).eq("id", activeOrder.id);
        toast.success(`${activeOrder.batch_id}: Department Items Completed!`, { icon: "✅" });
      }

      if (extraToStore > 0) {
        toast.info(`${extraToStore} units routed to Store Inventory.`, { icon: "📦" });
      }

      setActiveOrder(null);
      setIsSubmitting(false);
      fetchData();
    }, 1000);
  };

  const handleLogToStore = () => {
    setIsSubmitting(true);
    let totalLogged = 0;
    Object.values(storeLogData).forEach(val => { totalLogged += val; });

    setTimeout(() => {
      toast.success(`${totalLogged} units logged directly to Store Inventory.`, { icon: "🏭" });
      
      const resetData: Record<string, number> = {};
      myDepartmentProducts.forEach(p => { resetData[p.id] = 0; });
      setStoreLogData(resetData);
      
      setIsSubmitting(false);
    }, 800);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <Loader2 className="w-12 h-12 text-[#B8860B] animate-spin" />
      </div>
    );
  }

  // Safe UI Variables for parsing
  let tabTasksClass = "flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ";
  if (activeTab === "tasks") tabTasksClass += "bg-white text-slate-900 shadow-sm";
  else tabTasksClass += "text-slate-400 hover:text-white";

  let tabStoreClass = "flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ";
  if (activeTab === "store_log") tabStoreClass += "bg-emerald-500 text-white shadow-sm";
  else tabStoreClass += "text-slate-400 hover:text-white";

  return (
    <div className="bg-slate-50 min-h-screen pb-safe font-sans">
      <TopNavBar />
      
      {/* HEADER AND DEPARTMENT LOCK */}
      <div className="bg-slate-900 text-white pt-24 pb-4 px-4 sticky top-0 z-10 shadow-md">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-