import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_name: string;
  price: number;
  moq: number;
  sku: string | null;
  is_active: boolean;
}

export function useProductVariants(productId?: string) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!productId) { setVariants([]); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .eq("is_active", true)
      .order("created_at");
    setVariants(data || []);
    setLoading(false);
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  return { variants, loading, refetch: load };
}
