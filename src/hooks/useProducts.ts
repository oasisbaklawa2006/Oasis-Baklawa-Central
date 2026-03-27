import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Product = Tables<"products"> & { stock?: number };

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [prodRes, invRes] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("factory_inventory").select("product_id, quantity"),
      ]);

      const prods = prodRes.data || [];
      const inv = invRes.data || [];

      // Aggregate stock per product
      const stockMap: Record<string, number> = {};
      inv.forEach((r) => {
        if (r.product_id) {
          stockMap[r.product_id] = (stockMap[r.product_id] || 0) + (Number(r.quantity) || 0);
        }
      });

      setProducts(prods.map((p) => ({ ...p, stock: stockMap[p.id] || 0 })));
      setLoading(false);
    };
    load();
  }, []);

  return { products, loading };
}
