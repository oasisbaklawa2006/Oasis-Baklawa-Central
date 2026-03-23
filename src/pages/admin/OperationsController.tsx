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
  
  // 1. DEPARTMENT LOCK 
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
    
    // Fetch Orders (Reads the new 'category' column)
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

    // Fetch Products for Direct Store Logging
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