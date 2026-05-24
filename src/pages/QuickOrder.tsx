import AppShell from "@/components/AppShell";
import { useMemo, useState } from "react";
import { useProducts } from "@/hooks/useProducts";
import { useAuth } from "@/hooks/useAuth";
import QuickOrderTable from "@/components/catalogue/QuickOrderTable";
import { Search, Zap } from "lucide-react";

const QuickOrder = () => {
  const { products, loading } = useProducts();
  const { priceTier } = useAuth();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean) as string[]))],
    [products]
  );

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products.filter((p) => {
      if (cat !== "all" && p.category !== cat) return false;
      if (!t) return true;
      return (
        p.name?.toLowerCase().includes(t) ||
        p.sku?.toLowerCase().includes(t) ||
        p.category?.toLowerCase().includes(t) ||
        p.sub_category?.toLowerCase().includes(t)
      );
    });
  }, [products, q, cat]);

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 pb-28 pt-4 space-y-4">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-primary" />
          <div>
            <h1 className="font-display text-xl tracking-wide text-foreground">Quick Order Matrix</h1>
            <p className="text-[11px] text-muted-foreground">
              Franchisee high-speed entry · Quantities lock to exact pack-size multiples
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search SKU, name, category…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background"
            />
          </div>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-border bg-background"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>
            ))}
          </select>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4">
          <QuickOrderTable products={filtered} priceTier={priceTier} loading={loading} />
        </div>
      </div>
    </AppShell>
  );
};

export default QuickOrder;
