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
  const { user, loading: authLoading } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [draftOrder, setDraftOrder] = useState<DraftOrder | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchCartRequestRef = useRef(0);
  const pendingQuantitiesRef = useRef(new Map<string, number>());
  const quantitySyncTimeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const syncingItemIdsRef = useRef(new Set<string>());

  // Step 1: Fetch company_id once auth is ready (with impersonation support)
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setCompanyId(null);
      setLoading(false);
      return;
    }

    const fetchCompany = async () => {
      // Check for impersonation override
      const impersonated = localStorage.getItem("impersonated_client");
      if (impersonated) {
        try {
          const parsed = JSON.parse(impersonated);
          if (parsed.company_id) {
            
            setCompanyId(parsed.company_id);
            setCompanyIdResolved(true);
            return;
          }
        } catch {}
      }

      
      const { data } = await supabase
        .from("users")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();

      const cid = data?.company_id ?? null;
      
      setCompanyId(cid);
      setCompanyIdResolved(true);
    };

    fetchCompany();
  }, [user, authLoading]);

  // Step 2: Fetch cart only after company_id is resolved
  const fetchCart = useCallback(async () => {
    const requestId = ++fetchCartRequestRef.current;

    if (!companyId) {
      if (requestId === fetchCartRequestRef.current) {
        setLoading(false);
      }
      return;
    }

    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .eq("company_id", companyId)
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
  }, [companyId]);

  // Track whether company_id has been resolved (null means "not yet fetched", undefined would mean "fetched but empty")
  const [companyIdResolved, setCompanyIdResolved] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    if (!companyIdResolved) return; // still waiting for company fetch
    if (!companyId) { setLoading(false); return; } // company is truly null
    fetchCart();
  }, [companyId, companyIdResolved, fetchCart, user, authLoading]);

  const getOrCreateDraftOrder = async (): Promise<string | null> => {
    if (draftOrder) return draftOrder.id;

    if (!user) { toast.error("Please log in to add items to cart"); return null; }
    if (!companyId) { toast.error("Your account is pending B2B approval."); return null; }

    const { data: newOrder, error } = await supabase
      .from("orders")
      .insert({ status: "draft", company_id: companyId })
      .select()
      .single();

    if (error || !newOrder) { toast.error("Could not create cart order"); return null; }

    
    setDraftOrder(newOrder);
    return newOrder.id;
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
    loading: loading || authLoading,
    addToCart,
    updateQuantity,
    removeItem,
    fetchCart,
    clearCart,
  };
}
