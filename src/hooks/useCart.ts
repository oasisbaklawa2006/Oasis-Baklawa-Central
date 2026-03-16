import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  const [draftOrder, setDraftOrder] = useState<DraftOrder | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCart = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Get user's company_id
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) { setLoading(false); return; }

    // Find existing draft order
    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .eq("company_id", userData.company_id)
      .eq("status", "draft")
      .limit(1);

    const draft = orders?.[0] ?? null;
    setDraftOrder(draft);

    if (draft) {
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("*, product:products(*)")
        .eq("order_id", draft.id);

      setItems((orderItems as unknown as CartItem[]) ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchCart(); }, [fetchCart]);

  const getOrCreateDraftOrder = async (): Promise<string | null> => {
    if (draftOrder) return draftOrder.id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please log in to add items to cart"); return null; }

    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) { toast.error("No company linked to your account"); return null; }

    const { data: newOrder, error } = await supabase
      .from("orders")
      .insert({ status: "draft", company_id: userData.company_id })
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

    // Check if product already in cart
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
    if (quantity <= 0) {
      return removeItem(itemId);
    }
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

  return { draftOrder, items, loading, addToCart, updateQuantity, removeItem, fetchCart };
}
