import { useMemo, useState } from "react";
import { useCart } from "@/hooks/useCart";
import { useProducts, Product } from "@/hooks/useProducts";
import { getPacksPerCarton, unitsToFillCarton, getMinOrderQty } from "@/utils/pricing";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import CatalogueProductCard from "./CatalogueProductCard";

interface SuggestionChipsProps {
  activeCategory?: string | null;
}

const SuggestionChips = ({ activeCategory }: SuggestionChipsProps) => {
  const { items, addToCart } = useCart();
  const { products } = useProducts();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTitle, setSheetTitle] = useState("");
  const [sheetProducts, setSheetProducts] = useState<Product[]>([]);
  const [addingChip, setAddingChip] = useState<string | null>(null);

  const lastAddedProduct = useMemo(() => {
    if (!items.length) return null;
    const lastItem = items[items.length - 1];
    return products.find((p) => p.id === lastItem.product_id) || null;
  }, [items, products]);

  // Check if all cartons are full — hide chips when full
  const allCartonsFull = useMemo(() => {
    if (!items.length || !products.length) return false;
    return items.every((item) => {
      const product = products.find((p) => p.id === item.product_id);
      if (!product) return true;
      return unitsToFillCarton(product, item.quantity) === 0;
    });
  }, [items, products]);

  const categoryProducts = useMemo(() => {
    if (!activeCategory) return [];
    const cartIds = new Set(items.map((i) => i.product_id));
    return products.filter((p) => p.category === activeCategory && !cartIds.has(p.id)).slice(0, 12);
  }, [activeCategory, products, items]);

  const bestSellers = useMemo(() => {
    const cartIds = new Set(items.map((i) => i.product_id));
    return products.filter((p) => !cartIds.has(p.id)).slice(0, 8);
  }, [products, items]);

  // Only show when cart is active AND cartons are NOT all full
  if (!items.length || allCartonsFull) return null;

  const openSheet = (title: string, prods: Product[]) => {
    setSheetTitle(title);
    setSheetProducts(prods);
    setSheetOpen(true);
  };

  const handleQuickAdd = async (chipId: string, productId: string, qty: number, ps?: string | null, ct?: string | null) => {
    setAddingChip(chipId);
    await addToCart(productId, qty, ps, ct);
    setAddingChip(null);
  };

  const chips: { id: string; label: string; action: () => void }[] = [];

  // +2 Same Product
  if (lastAddedProduct) {
    const toFill = unitsToFillCarton(lastAddedProduct, items.find(i => i.product_id === lastAddedProduct.id)?.quantity || 0);
    if (toFill > 0) {
      chips.push({
        id: "fill-last",
        label: `+${toFill} ${lastAddedProduct.name.slice(0, 16)}…`,
        action: () => handleQuickAdd("fill-last", lastAddedProduct.id, toFill, lastAddedProduct.pack_size, lastAddedProduct.carton_type),
      });
    }
  }

  if (categoryProducts.length > 0) {
    chips.push({
      id: "category",
      label: "More in Range",
      action: () => openSheet("More in This Range", categoryProducts),
    });
  }

  if (bestSellers.length > 0) {
    chips.push({
      id: "bestsellers",
      label: "Top Picks",
      action: () => openSheet("Top Fill Picks", bestSellers),
    });
  }

  if (!chips.length) return null;

  return (
    <>
      <div className="fixed bottom-[7.5rem] left-0 right-0 z-20 px-4">
        <div className="max-w-md mx-auto flex gap-2 overflow-x-auto scrollbar-hide py-1">
          {chips.map((chip) => (
            <button
              key={chip.id}
              onClick={chip.action}
              disabled={addingChip === chip.id}
              className="flex-shrink-0 px-3 py-1.5 rounded-full border border-primary/30 bg-card font-body text-[11px] text-foreground hover:bg-primary/10 transition-colors whitespace-nowrap disabled:opacity-50"
            >
              {addingChip === chip.id ? <Loader2 size={10} className="animate-spin inline mr-1" /> : null}
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[70vh] rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="font-display text-lg">{sheetTitle}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 mt-4 overflow-y-auto max-h-[50vh] pb-4">
            {sheetProducts.map((p) => (
              <CatalogueProductCard key={p.id} item={p} />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default SuggestionChips;
