import { useCallback, useEffect, useState } from "react";
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

export function useCart() {
  const { user, loading: authLoading } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [draftOrder, setDraftOrder] = useState<DraftOrder | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Step 1: Fetch company_id once auth is ready
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setCompanyId(null);
      setLoading(false);
      return;
    }

    const fetchCompany = async () => {
      console.log("[useCart] auth user id:", user.id);
      const { data } = await supabase
        .from("users")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();

      const cid = data?.company_id ?? null;
      console.log("[useCart] company_id fetched:", cid);
      setCompanyId(cid);
    };

    fetchCompany();
  }, [user, authLoading]);

  // Step 2: Fetch cart only after company_id is resolved
  const fetchCart = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "draft")
      .limit(1);

    const draft = orders?.[0] ?? null;
    console.log("[useCart] draft order id:", draft?.id ?? "none");
    setDraftOrder(draft);

    if (draft) {
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("*, product:products(*)")
        .eq("order_id", draft.id);

      setItems((orderItems as unknown as CartItem[]) ?? []);
    } else {
      setItems([]);
    }

    setLoading(false);
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

    console.log("[useCart] created draft order:", newOrder.id);
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

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity <= 0) return removeItem(itemId);
    const { error } = await supabase
      .from("order_items")
      .update({ quantity })
      .eq("id", itemId);

    if (error) { toast.error("Failed to update quantity"); return; }
    await fetchCart();
  };

  const removeItem = async (itemId: string) => {
    const { error } = await supabase
      .from("order_items")
      .delete()
      .eq("id", itemId);

    if (error) { toast.error("Failed to remove item"); return; }
    await fetchCart();
  };

  return { draftOrder, items, loading: loading || authLoading, addToCart, updateQuantity, removeItem, fetchCart };
}
