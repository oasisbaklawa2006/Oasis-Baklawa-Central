import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Product = Tables<"products"> & { stock?: number };

// In-memory SWR cache — survives across hook instances within the same session.
const CACHE_KEY = "oasis_products_swr";
let memoryCache: Product[] | null = null;

function readPersistedCache(): Product[] | null {
  if (memoryCache) return memoryCache;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Product[];
    memoryCache = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(products: Product[]) {
  memoryCache = products;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(products));
  } catch {}
}

export function useProducts() {
  const cached = readPersistedCache();
  const [products, setProducts] = useState<Product[]>(cached ?? []);
  // If we already have cached data, never show the loading spinner — SWR pattern.
  const [loading, setLoading] = useState<boolean>(!cached);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const [prodRes, invRes] = await Promise.all([
      supabase.from("products").select("*"),
      supabase.from("factory_inventory").select("product_id, quantity"),
    ]);

    if (!mounted.current) return;

    const prods = prodRes.data || [];
    const inv = invRes.data || [];

    const stockMap: Record<string, number> = {};
    inv.forEach((r) => {
      if (r.product_id) {
        stockMap[r.product_id] = (stockMap[r.product_id] || 0) + (Number(r.quantity) || 0);
      }
    });

    const merged = prods.map((p) => ({ ...p, stock: stockMap[p.id] || 0 }));
    writeCache(merged);
    setProducts(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    // Always revalidate in background — instant render from cache, fresh data on return.
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  return { products, loading, refetch: load };
}
