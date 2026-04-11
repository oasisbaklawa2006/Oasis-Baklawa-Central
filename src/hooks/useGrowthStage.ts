import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type GrowthStage = "new" | "growth" | "advanced";

interface GrowthData {
  stage: GrowthStage;
  orderCount: number;
  loading: boolean;
  buttonLabel: string;
  orderedCategories: string[];
  orderedProductIds: string[];
  productFrequency: Record<string, number>;
}

export const useGrowthStage = (): GrowthData => {
  const { user, companyId } = useAuth();
  const [orderCount, setOrderCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [orderedCategories, setOrderedCategories] = useState<string[]>([]);
  const [orderedProductIds, setOrderedProductIds] = useState<string[]>([]);
  const [productFrequency, setProductFrequency] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }

    const fetch = async () => {
      // Get order count (non-draft)
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .not("status", "in", '("draft","cart")');

      setOrderCount(count ?? 0);

      // Get ordered items for gap detection & frequency
      const { data: items } = await supabase
        .from("order_items")
        .select("product_id, quantity, order_id")
        .in(
          "order_id",
          (await supabase
            .from("orders")
            .select("id")
            .eq("company_id", companyId)
            .not("status", "in", '("draft","cart")')
          ).data?.map((o) => o.id) ?? []
        );

      if (items) {
        const pids = [...new Set(items.map((i) => i.product_id).filter(Boolean))] as string[];
        setOrderedProductIds(pids);

        // Frequency map
        const freq: Record<string, number> = {};
        items.forEach((i) => {
          if (i.product_id) freq[i.product_id] = (freq[i.product_id] || 0) + (i.quantity || 1);
        });
        setProductFrequency(freq);

        // Get categories of ordered products
        if (pids.length > 0) {
          const { data: prods } = await supabase
            .from("products")
            .select("category")
            .in("id", pids);
          setOrderedCategories([...new Set(prods?.map((p) => p.category).filter(Boolean))] as string[]);
        }
      }

      setLoading(false);
    };

    fetch();
  }, [companyId]);

  const stage: GrowthStage = orderCount > 10 ? "advanced" : orderCount >= 3 ? "growth" : "new";
  const buttonLabel = stage === "new" ? "Starter Guide" : stage === "growth" ? "Smart Reorder" : "Growth Insights";

  return { stage, orderCount, loading, buttonLabel, orderedCategories, orderedProductIds, productFrequency };
};
