import { useState } from "react";
import { useCart } from "@/hooks/useCart";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useProducts, Product } from "@/hooks/useProducts";
import { getDisplayPrice, getMinOrderQty, getQtyIncrement, calculatePackPrice, getPackDescription } from "@/utils/pricing";
import { Minus, Plus, Loader2 } from "lucide-react";

interface QuickOrderTableProps {
  products: Product[];
}

const QuickOrderRow = ({ product }: { product: Product }) => {
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();
  const moq = getMinOrderQty(product);
  const increment = getQtyIncrement(product);
  const displayInfo = getDisplayPrice(product);
  const packPrice = calculatePackPrice(product);

  const [qty, setQty] = useState(0);
  const [adding, setAdding] = useState(false);

  const lineTotal = packPrice * qty;

  const handleIncrement = () => {
    setQty((q) => (q === 0 ? moq : q + increment));
  };

  const handleDecrement = () => {
    setQty((q) => {
      if (q <= 0) return 0;
      if (q <= moq) return 0;
      const next = q - increment;
      return next < moq ? 0 : next;
    });
  };

  const handleAdd = async () => {
    if (qty <= 0) return;
    setAdding(true);
    await addToCart(product.id, qty, product.pack_size ?? null, product.carton_type ?? null);
    setAdding(false);
    setQty(0);
  };

  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-2.5 pr-2">
        <p className="font-body text-xs font-medium text-foreground line-clamp-2 leading-snug">{product.name}</p>
        <p className="font-body text-[10px] text-muted-foreground">{product.sub_category || product.category}</p>
        <p className="font-body text-[9px] text-muted-foreground/70">MOQ: {moq} | Pack Size: {increment}</p>
      </td>
      <td className="py-2.5 px-1 text-center">
        <p className="font-body text-[10px] text-muted-foreground">MOQ {moq}</p>
      </td>
      <td className="py-2.5 px-1 text-right">
        <p className="font-body text-xs text-foreground">{formatPrice(displayInfo.price)}<span className="text-[9px] text-muted-foreground">{displayInfo.unit}</span></p>
      </td>
      <td className="py-2.5 px-1">
        <div className="flex items-center justify-center gap-0 bg-muted rounded-full px-0.5 py-0.5">
          <button
            onClick={handleDecrement}
            className="w-6 h-6 rounded-full bg-foreground text-primary-foreground flex items-center justify-center"
          >
            <Minus size={10} />
          </button>
          <span className="font-body text-xs font-medium w-7 text-center text-foreground">{qty}</span>
          <button
            onClick={handleIncrement}
            className="w-6 h-6 rounded-full bg-foreground text-primary-foreground flex items-center justify-center"
          >
            <Plus size={10} />
          </button>
        </div>
      </td>
      <td className="py-2.5 pl-1 text-right">
        <p className="font-body text-xs font-medium text-foreground">{qty > 0 ? formatPrice(lineTotal) : "—"}</p>
      </td>
      <td className="py-2.5 pl-2">
        <button
          onClick={handleAdd}
          disabled={adding || qty === 0}
          className="bg-foreground text-primary-foreground font-body text-[10px] font-medium px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {adding ? <Loader2 size={10} className="animate-spin" /> : "Add"}
        </button>
      </td>
    </tr>
  );
};

const QuickOrderTable = ({ products }: QuickOrderTableProps) => {
  if (!products.length) {
    return <p className="text-center text-muted-foreground py-8 font-body text-sm">No products found.</p>;
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full min-w-[500px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left font-body text-[10px] text-muted-foreground uppercase tracking-wider py-2 pr-2">Product</th>
            <th className="font-body text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-1">MOQ</th>
            <th className="text-right font-body text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-1">Price</th>
            <th className="font-body text-[10px] text-muted-foreground uppercase tracking-wider py-2 px-1">Qty</th>
            <th className="text-right font-body text-[10px] text-muted-foreground uppercase tracking-wider py-2 pl-1">Total</th>
            <th className="py-2 pl-2"></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <QuickOrderRow key={p.id} product={p} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default QuickOrderTable;
