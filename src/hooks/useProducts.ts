import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { isBuyerVisibleProduct } from "@/lib/buyerCatalogue";

export type Product = Tables<"products"> & { stock?: number };

// In-memory SWR cache — survives across hook instances within the same session.
const CACHE_KEY = "oasis_products_swr";
let memoryCache: Product[] | null = null;

function filterBuyerVisibleProducts(products: Product[]): Product[] {
  return products.filter(isBuyerVisibleProduct);
}

/**
 * Returns filtered buyer-visible products, or null when no cache entry exists.
 * An empty array means cache existed but nothing passed the buyer-visible predicate.
 */
function readPersistedCache(): Product[] | null {
  if (memoryCache) return filterBuyerVisibleProducts(memoryCache);

  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Product[];
    const visible = filterBuyerVisibleProducts(parsed);
    memoryCache = visible;
    if (visible.length !== parsed.length) {
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(visible));
      } catch {}
    }
    return visible;
  } catch {
    return null;
  }
}

function writeCache(products: Product[]) {
  const visible = filterBuyerVisibleProducts(products);
  memoryCache = visible;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(visible));
  } catch {}
}

export function useProducts() {
  const cached = readPersistedCache();
  const [products, setProducts] = useState<Product[]>(cached ?? []);
  // If we already have cached data, never show the loading spinner — SWR pattern.
  const [loading, setLoading] = useState<boolean>(cached === null);
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

    const buyerVisible = filterBuyerVisibleProducts(prods);
    const merged = buyerVisible.map((p) => ({ ...p, stock: stockMap[p.id] || 0 }));
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
