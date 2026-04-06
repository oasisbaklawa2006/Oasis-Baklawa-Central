import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface CartItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  pack_size: string | null;
  carton_type: string | null;
  notes: string | null;
  product?: {
    id: string;
    name: string;
    price_per_kg: number;
    image_url: string | null;
    pack_size: string | null;
    carton_type: string | null;
  };
}

export interface DraftOrder {
  id: string;
  company_id: string | null;
  status: string;
}

const sortCartItems = (cartItems: CartItem[]) =>
  [...cartItems].sort((a, b) => (a.id || "").localeCompare(b.id || ""));

export function useCart() {
  const { user, loading: authLoading, companyId, profileReady } = useAuth();
  const [draftOrder, setDraftOrder] = useState<DraftOrder | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchCartRequestRef = useRef(0);
  const pendingQuantitiesRef = useRef(new Map<string, number>());
  const quantitySyncTimeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const syncingItemIdsRef = useRef(new Set<string>());
  const draftCreationPromiseRef = useRef<Promise<string | null> | null>(null);

  // Resolve effective company_id (impersonation takes precedence)
  const effectiveCompanyId = (() => {
    const impersonated = localStorage.getItem("impersonated_client");
    if (impersonated) {
      try {
        const parsed = JSON.parse(impersonated);
        if (parsed.company_id) return parsed.company_id;
      } catch {}
    }
    return companyId;
  })();

  // Fetch cart once profile + company_id are resolved
  const fetchCart = useCallback(async () => {
    const requestId = ++fetchCartRequestRef.current;

    if (!effectiveCompanyId) {
      if (requestId === fetchCartRequestRef.current) {
        setLoading(false);
      }
      return;
    }

    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .eq("company_id", effectiveCompanyId)
      .eq("status", "draft")
      .limit(1);

    const draft = orders?.[0] ?? null;

    if (requestId !== fetchCartRequestRef.current) return;
    setDraftOrder(draft);

    if (draft) {
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("*, product:products(*)")
        .eq("order_id", draft.id);

      if (requestId !== fetchCartRequestRef.current) return;
      setItems(sortCartItems((orderItems as unknown as CartItem[]) ?? []));
    } else {
      if (requestId !== fetchCartRequestRef.current) return;
      setItems([]);
    }

    if (requestId === fetchCartRequestRef.current) {
      setLoading(false);
    }
  }, [effectiveCompanyId]);

  useEffect(() => {
    if (authLoading || !profileReady) return;
    if (!user) { setLoading(false); return; }
    if (!effectiveCompanyId) { setLoading(false); return; }
    fetchCart();
  }, [effectiveCompanyId, profileReady, fetchCart, user, authLoading]);

  const getOrCreateDraftOrder = async (): Promise<string | null> => {
    if (draftOrder) return draftOrder.id;

    // Mutex: if a creation is already in-flight, reuse that promise
    if (draftCreationPromiseRef.current) return draftCreationPromiseRef.current;

    if (!user) { toast.error("Please log in to add items to cart"); return null; }
    if (!effectiveCompanyId) { toast.error("Your account is pending B2B approval."); return null; }

    const creationPromise = (async () => {
      try {
        // Double-check: maybe another tab/request already created one
        const { data: existing } = await supabase
          .from("orders")
          .select("id")
          .eq("company_id", effectiveCompanyId)
          .eq("status", "draft")
          .limit(1);

        if (existing && existing.length > 0) {
          setDraftOrder({ id: existing[0].id, company_id: effectiveCompanyId, status: "draft" });
          return existing[0].id;
        }

        const { data: newOrder, error } = await supabase
          .from("orders")
          .insert({ status: "draft", company_id: effectiveCompanyId })
          .select()
          .single();

        if (error || !newOrder) { toast.error("Could not create cart order"); return null; }

        setDraftOrder(newOrder);
        return newOrder.id;
      } finally {
        draftCreationPromiseRef.current = null;
      }
    })();

    draftCreationPromiseRef.current = creationPromise;
    return creationPromise;
  };

  const addToCart = async (
    productId: string,
    quantity: number,
    packSize?: string | null,
    cartonType?: string | null
  ) => {
    const orderId = await getOrCreateDraftOrder();
    if (!orderId) return false;

    const existing = items.find((it) => it.product_id === productId);

    if (existing) {
      const newQty = existing.quantity + quantity;
      const { error } = await supabase
        .from("order_items")
        .update({ quantity: newQty })
        .eq("id", existing.id);

      if (error) { toast.error("Failed to update cart"); return false; }
    } else {
      const { error } = await supabase
        .from("order_items")
        .insert({
          order_id: orderId,
          product_id: productId,
          quantity,
          pack_size: packSize ?? null,
          carton_type: cartonType ?? null,
        });

      if (error) { toast.error("Failed to add to cart"); return false; }
    }

    await fetchCart();
    toast.success("Added to cart");
    return true;
  };

  const syncPendingQuantity = useCallback(async (itemId: string) => {
    if (syncingItemIdsRef.current.has(itemId)) return;

    syncingItemIdsRef.current.add(itemId);

    try {
      while (pendingQuantitiesRef.current.has(itemId)) {
        const nextQuantity = pendingQuantitiesRef.current.get(itemId);
        pendingQuantitiesRef.current.delete(itemId);

        if (nextQuantity == null) break;

        const { error } = await supabase
          .from("order_items")
          .update({ quantity: nextQuantity })
          .eq("id", itemId);

        if (error) throw error;
      }

      await fetchCart();
    } catch {
      toast.error("Failed to update quantity");
      await fetchCart();
    } finally {
      syncingItemIdsRef.current.delete(itemId);

      if (pendingQuantitiesRef.current.has(itemId)) {
        void syncPendingQuantity(itemId);
      }
    }
  }, [fetchCart]);

  const scheduleQuantitySync = useCallback((itemId: string) => {
    const existingTimeout = quantitySyncTimeoutsRef.current.get(itemId);

    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeoutId = setTimeout(() => {
      quantitySyncTimeoutsRef.current.delete(itemId);
      void syncPendingQuantity(itemId);
    }, 180);

    quantitySyncTimeoutsRef.current.set(itemId, timeoutId);
  }, [syncPendingQuantity]);

  const removeItem = useCallback(async (itemId: string) => {
    const existingTimeout = quantitySyncTimeoutsRef.current.get(itemId);

    if (existingTimeout) {
      clearTimeout(existingTimeout);
      quantitySyncTimeoutsRef.current.delete(itemId);
    }

    pendingQuantitiesRef.current.delete(itemId);
    setItems((prev) => sortCartItems(prev.filter((item) => item.id !== itemId)));

    const { error } = await supabase
      .from("order_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      toast.error("Failed to remove item");
      await fetchCart();
      return;
    }

    await fetchCart();
  }, [fetchCart]);

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeItem(itemId);
      return;
    }

    setItems((prev) => sortCartItems(
      prev.map((item) => item.id === itemId ? { ...item, quantity } : item)
    ));
    pendingQuantitiesRef.current.set(itemId, quantity);
    scheduleQuantitySync(itemId);
  }, [removeItem, scheduleQuantitySync]);

  const clearCart = useCallback(() => {
    setDraftOrder(null);
    setItems([]);
    setLoading(false);
    quantitySyncTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    quantitySyncTimeoutsRef.current.clear();
    pendingQuantitiesRef.current.clear();
    syncingItemIdsRef.current.clear();

    if (typeof window !== "undefined") {
      localStorage.removeItem("oasis_cart");
      localStorage.removeItem("cart");
      localStorage.removeItem("draftOrderId");
      localStorage.removeItem("impersonated_client");
    }
  }, []);

  return {
    draftOrder,
    items,
    loading: loading || authLoading || !profileReady,
    addToCart,
    updateQuantity,
    removeItem,
    fetchCart,
    clearCart,
    companyId: effectiveCompanyId,
  };
}
