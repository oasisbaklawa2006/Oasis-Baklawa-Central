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
  
  // DEPARTMENT LOCK (Simulating a logged-in floor manager's assigned department)
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
    
    // 1. Fetch Orders (Anonymous, no company names)
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

    // 2. Fetch Products for the Direct-to-Store tab
    const { data: prodData } = await supabase.from("products").select("id, name, category, image_url");
    if (prodData) {
      setDepartmentProducts(prodData);
      
      // Initialize store log state
      const initialStoreData: Record<string, number> = {};
      prodData.forEach(p => initialStoreData[p.id] = 0);
      setStoreLogData(initialStoreData);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // FILTER LOGIC: Only show orders that contain items belonging to MY department
  const myDepartmentOrders = orders.filter(order => 
    order.items.some(item => item.category === myDepartment || (!item.category && myDepartment === "Baklawa"))
  );

  const myDepartmentProducts = departmentProducts.filter(p => p.category === myDepartment || (!p.category && myDepartment === "Baklawa"));

  const openPackingScreen = (order: OperationOrder) => {
    const initialPack: Record<string, number> = {};
    // ONLY populate items that belong to THIS department
    order.items
      .filter(item => item.category === myDepartment || (!item.category && myDepartment === "Baklawa"))
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

  // ------------------------------------------------------------------
  // SMART ALLOCATION LOGIC (Order vs Store)
  // ------------------------------------------------------------------
  const handleProcessOrder = async () => {
    if (!activeOrder) return;
    setIsSubmitting(true);

    let isPartial = false;
    let extraToStore = 0;

    activeOrder.items
      .filter(item => item.category === myDepartment || (!item.category && myDepartment === "Baklawa"))
      .forEach(item => {
        const produced = packData[item.id];
        if (produced < item.quantity_ordered) isPartial = true;
        if (produced > item.quantity_ordered) extraToStore += (produced - item.quantity_ordered);
      });

    setTimeout(() => {
      if (isPartial) {
        toast.warning(`${activeOrder.batch_id}: Partial Fulfillment Logged.`, { icon: "⚠️" });
      } else {
        toast.success(`${activeOrder.batch_id}: Department Items Completed!`, { icon: "✅" });
      }

      if (extraToStore > 0) {
        toast.info(`${extraToStore} excess units successfully routed to Store Inventory.`, { icon: "📦" });
      }

      setActiveOrder(null);
      setIsSubmitting(false);
      // In a real app, update DB status/inventory here
    }, 1000);
  };

  const handleLogToStore = () => {
    setIsSubmitting(true);
    let totalLogged = 0;
    Object.values(storeLogData).forEach(val => totalLogged += val);

    setTimeout(() => {
      toast.success(`${totalLogged} total units logged directly to Store Inventory.`, { icon: "🏭" });
      
      // Reset the stepper
      const resetData: Record<string, number> = {};
      myDepartmentProducts.forEach(p => resetData[p.id] = 0);
      setStoreLogData(resetData);
      
      setIsSubmitting(false);
    }, 800);
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-900"><Loader2 className="w-12 h-12 text-white animate-spin" /></div>;

  return (
    <div className="bg-slate-100 min-h-screen pb-safe font-sans">
      <TopNavBar />
      
      {/* HEADER & DEPARTMENT LOCK */}
      <div className="bg-slate-900 text-white pt-20 pb-4 px-4 sticky top-0 z-10 shadow-md">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-wider uppercase">Floor Controller</h1>
            <p className="text-xs text-slate-400 font-bold tracking-widest mt-1">Anonymized Production</p>
          </div>
          
          {/* Department Switcher (In production, this is usually locked to the logged-in user's role) */}
          <select 
            value={myDepartment} 
            onChange={(e) => setMyDepartment(e.target.value)}
            className="bg-white/10 border border-white/20 text-white text-xs font-bold py-2 px-3 rounded-lg outline-none"
          >
            {DEPARTMENTS.map(d => <option key={d} value={d} className="text-black">{d} Dept</option>)}
          </select>
        </div>
        
        {/* TABS: Order Tasks vs Direct