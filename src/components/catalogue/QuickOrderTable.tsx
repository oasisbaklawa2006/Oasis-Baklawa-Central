import { useState } from "react";
import { useCart } from "@/hooks/useCart";
import { useCurrency } from "@/contexts/CurrencyContext";
import type { Product } from "@/hooks/useProducts";
import {
  getDisplayPrice,
  getMinOrderQty,
  getQtyIncrement,
  calculatePackPrice,
  getPackDescription,
} from "@/utils/pricing";
import { Minus, Plus, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface QuickOrderTableProps {
  products: Product[];
  priceTier?: string | null;
  /** When true, shows a compact skeleton instead of rows (products ignored). */
  loading?: boolean;
}

function QuickOrderLine({
  product,
  priceTier,
  layout,
}: {
  product: Product;
  priceTier?: string | null;
  layout: "card" | "row";
}) {
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();
  const moq = getMinOrderQty(product);
  const increment = getQtyIncrement(product);
  const displayInfo = getDisplayPrice(product, priceTier);
  const packPrice = calculatePackPrice(product, priceTier);
  const packDesc = getPackDescription(product);

  const [qty, setQty] = useState(0);
  const [adding, setAdding] = useState(false);

  const lineTotal = packPrice * qty;
  const productLabel = product.name ?? "Product";

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

  const qtyControl = (
    <div
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-full border border-border bg-muted/80 p-1",
        layout === "card" && "w-full max-w-[11rem]",
      )}
      role="group"
      aria-label={`Quantity for ${productLabel}`}
    >
      <button
        type="button"
        onClick={handleDecrement}
        disabled={qty <= 0}
        aria-label={`Decrease quantity for ${productLabel}`}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-35"
      >
        <Minus size={16} aria-hidden />
      </button>
      <span
        className="min-w-[2.25rem] text-center font-body text-sm font-semibold tabular-nums text-foreground"
        aria-live="polite"
      >
        {qty}
      </span>
      <button
        type="button"
        onClick={handleIncrement}
        aria-label={`Increase quantity for ${productLabel}`}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Plus size={16} aria-hidden />
      </button>
    </div>
  );

  if (layout === "card") {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="min-w-0 space-y-1">
          <p className="font-body text-sm font-semibold leading-snug text-foreground break-words">{product.name}</p>
          <p className="font-body text-xs text-muted-foreground">{product.sub_category || product.category}</p>
        </div>
        <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground" aria-label={`Minimum order ${moq} units, ${packDesc}`}>
          <span className="font-semibold text-foreground">MOQ {moq}</span>
          <span className="mx-1.5 text-border">·</span>
          <span>{packDesc}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-body text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Unit price</p>
            <p className="font-number text-base font-semibold text-foreground">
              {formatPrice(displayInfo.price)}
              <span className="text-xs font-body font-normal text-muted-foreground">{displayInfo.unit}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="font-body text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Line</p>
            <p className="font-number text-base font-semibold text-foreground">{qty > 0 ? formatPrice(lineTotal) : "—"}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {qtyControl}
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || qty === 0}
            aria-label={qty === 0 ? `Add to cart (choose quantity first) — ${productLabel}` : `Add ${qty} units to cart — ${productLabel}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-foreground px-5 font-body text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45"
          >
            {adding ? <Loader2 size={18} className="animate-spin" aria-hidden /> : "Add to cart"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="max-w-[14rem] py-3 pr-3 align-top">
        <p className="font-body text-sm font-medium leading-snug text-foreground break-words">{product.name}</p>
        <p className="font-body text-xs text-muted-foreground">{product.sub_category || product.category}</p>
        <p className="mt-1 font-body text-[11px] text-muted-foreground" title={`MOQ ${moq} · ${packDesc}`}>
          MOQ <span className="font-semibold text-foreground">{moq}</span>
          <span className="mx-1">·</span>
          {packDesc}
        </p>
      </td>
      <td className="py-3 px-2 text-right align-middle">
        <p className="font-number text-sm font-semibold text-foreground">
          {formatPrice(displayInfo.price)}
          <span className="text-[10px] font-body font-normal text-muted-foreground">{displayInfo.unit}</span>
        </p>
      </td>
      <td className="py-3 px-2 align-middle">{qtyControl}</td>
      <td className="py-3 px-2 text-right align-middle">
        <p className="font-number text-sm font-semibold text-foreground">{qty > 0 ? formatPrice(lineTotal) : "—"}</p>
      </td>
      <td className="py-3 pl-2 align-middle">
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || qty === 0}
          aria-label={qty === 0 ? `Add to cart (choose quantity) — ${productLabel}` : `Add ${qty} to cart — ${productLabel}`}
          className="inline-flex min-h-10 min-w-[5.5rem] items-center justify-center rounded-xl bg-foreground px-4 font-body text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45"
        >
          {adding ? <Loader2 size={14} className="animate-spin" aria-hidden /> : "Add"}
        </button>
      </td>
    </tr>
  );
}

function QuickOrderSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading quick order rows">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-xl border border-border/60 p-4 md:items-center">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-[min(100%,14rem)]" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="hidden h-10 w-28 shrink-0 md:block" />
          <Skeleton className="h-11 w-32 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

const QuickOrderTable = ({ products, priceTier, loading }: QuickOrderTableProps) => {
  if (loading) {
    return <QuickOrderSkeleton />;
  }

  if (!products.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center" role="status">
        <p className="font-body text-sm font-medium text-foreground">No products match this view</p>
        <p className="mt-2 font-body text-xs text-muted-foreground">Try another category or clear your search.</p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="md:hidden space-y-3">
        {products.map((p) => (
          <QuickOrderLine key={p.id} product={p} priceTier={priceTier} layout="card" />
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto rounded-xl border border-border/80">
        <table className="w-full min-w-[520px] text-left">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-3 font-body text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Product
              </th>
              <th className="px-2 py-3 text-right font-body text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Price
              </th>
              <th className="px-2 py-3 text-center font-body text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Qty
              </th>
              <th className="px-2 py-3 text-right font-body text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Line
              </th>
              <th className="w-24 px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <QuickOrderLine key={p.id} product={p} priceTier={priceTier} layout="row" />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default QuickOrderTable;
