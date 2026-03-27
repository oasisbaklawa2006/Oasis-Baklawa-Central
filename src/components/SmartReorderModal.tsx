import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useCart } from "@/hooks/useCart";
import { Package, Plus, Minus, ShoppingCart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { calculatePackPrice } from "@/utils/pricing";
import { supabase } from "@/integrations/supabase/client";

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  pack_size: string | null;
  carton_type: string | null;
  product?: {
    id: string;
    name: string;
    price_per_kg: number;
    image_url: string | null;
    pack_size: string | null;
    carton_type: string | null;
    wholesale_price?: number | null;
    mrp?: number | null;
    avg_weight_per_pack?: number | null;
    net_weight_grams?: number | null;
  };
}

interface SmartReorderModalProps {
  open: boolean;
  onClose: () => void;
  order: {
    id: string;
    order_items?: OrderItem[];
  } | null;
}

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN");

const SmartReorderModal = ({ open, onClose, order }: SmartReorderModalProps) => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Fetch items when order changes
  useEffect(() => {
    if (!open || !order) {
      setItems([]);
      setSelectedIds(new Set());
      setQuantities({});
      return;
    }

    // If order already has items embedded, use them directly
    if (order.order_items && order.order_items.length > 0) {
      const orderItems = order.order_items;
      setItems(orderItems);
      setSelectedIds(new Set(orderItems.map((i) => i.id)));
      setQuantities(Object.fromEntries(orderItems.map((i) => [i.id, i.quantity])));
      return;
    }

    // Otherwise fetch from DB
    const fetchItems = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("order_items")
          .select("id, product_id, quantity, pack_size, carton_type, product:products(id, name, price_per_kg, image_url, pack_size, carton_type, wholesale_price, mrp, avg_weight_per_pack, net_weight_grams)")
          .eq("order_id", order.id);

        if (error) throw error;

        const fetched = (data ?? []) as unknown as OrderItem[];
        setItems(fetched);
        setSelectedIds(new Set(fetched.map((i) => i.id)));
        setQuantities(Object.fromEntries(fetched.map((i) => [i.id, i.quantity])));
      } catch (err: any) {
        console.error("SmartReorder fetch error:", err);
        toast.error(err.message || "Failed to load order items");
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [open, order?.id]);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateQty = (id: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(1, (prev[id] ?? 1) + delta),
    }));
  };

  const handleSubmit = async () => {
    const toAdd = items.filter((i) => selectedIds.has(i.id));
    if (toAdd.length === 0) {
      toast.error("Please select at least one item");
      return;
    }

    setSubmitting(true);
    for (const item of toAdd) {
      await addToCart(
        item.product_id,
        quantities[item.id] ?? item.quantity,
        item.pack_size,
        item.carton_type
      );
    }
    setSubmitting(false);
    onClose();
    navigate("/cart");
  };

  const selectedCount = items.filter((i) => selectedIds.has(i.id)).length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-foreground">
            Smart Reorder
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Adjust quantities and uncheck items you don't need.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-2 -mx-2 px-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={28} className="animate-spin text-primary mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">Fetching your order...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">No items in this order</p>
            </div>
          ) : (
            items.map((item) => {
              const price = calculatePackPrice(item.product);
              const qty = quantities[item.id] ?? item.quantity;
              const checked = selectedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    checked
                      ? "bg-card border-border"
                      : "bg-muted/30 border-transparent opacity-60"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleItem(item.id)}
                    className="shrink-0"
                  />

                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {item.product?.image_url ? (
                      <img src={item.product.image_url} alt="" className="w-8 h-8 object-contain" />
                    ) : (
                      <Package size={16} className="text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {item.product?.name ?? "Product"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.product?.pack_size ?? ""} · {formatPrice(price)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => updateQty(item.id, -1)}
                      disabled={!checked}
                      className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-40"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-foreground">{qty}</span>
                    <button
                      onClick={() => updateQty(item.id, 1)}
                      disabled={!checked}
                      className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-40"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!loading && (
          <div className="pt-4 border-t border-border">
            <button
              onClick={handleSubmit}
              disabled={submitting || selectedCount === 0}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ShoppingCart size={16} />
              )}
              Add {selectedCount} Item{selectedCount !== 1 ? "s" : ""} to Cart
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SmartReorderModal;
