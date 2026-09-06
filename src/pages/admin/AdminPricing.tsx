import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Search, CheckCircle2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useScopedRealtimeSubscription } from "@/hooks/useScopedRealtimeSubscription";
import { PRODUCTS_UPDATE_CHANGES } from "@/lib/realtime";

interface ProductPriceRow {
  id: string | null;
  name: string | null;
  category: string | null;
  mrp: number | null;
  price_b2b: number | null;
  price_horeca: number | null;
  price_special: number | null;
}

const toEditableValue = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

const PriceCell = ({
  productId,
  field,
  value,
  onSaved,
}: {
  productId: string;
  field: keyof Pick<ProductPriceRow, "mrp" | "price_b2b" | "price_horeca" | "price_special">;
  value: number | null;
  onSaved: (id: string, field: keyof ProductPriceRow, val: number | null) => void;
}) => {
  const [local, setLocal] = useState<string>(toEditableValue(value));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const originalRef = useRef<number | null>(value);

  useEffect(() => {
    setLocal(toEditableValue(value));
    originalRef.current = value;
  }, [value]);

  const handleBlur = async () => {
    const trimmed = local.trim();
    const numVal = trimmed === "" ? null : Number(trimmed);

    if (trimmed !== "" && Number.isNaN(numVal)) return;
    if (numVal === originalRef.current) return;

    setSaving(true);

    const { error } = await supabase
      .from("products")
      .update({ [field]: numVal } as any)
      .eq("id", productId);

    if (error) {
      toast.error(`Save failed: ${error.message}`);
      setLocal(toEditableValue(originalRef.current));
    } else {
      originalRef.current = numVal;
      onSaved(productId, field, numVal);
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    }

    setSaving(false);
  };

  return (
    <div className="relative flex items-center justify-end gap-1">
      <Input
        type="number"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={handleBlur}
        className="h-9 w-24 text-right rounded-lg border-input font-medium"
        placeholder="—"
      />
      {saving && <Loader2 size={14} className="absolute -right-5 animate-spin text-primary" />}
      {saved && <CheckCircle2 size={14} className="absolute -right-5 text-green-600" />}
    </div>
  );
};

const AdminPricing = () => {
  const [products, setProducts] = useState<ProductPriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMissingOnly, setShowMissingOnly] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("id, name, category, mrp, price_b2b, price_horeca, price_special, base_price, wholesale_price, price_per_kg")
      .order("name");

    if (error) {
      toast.error("Failed to load products: " + error.message);
    } else {
      console.log("AdminPricing Fetched Data:", data);
      setProducts(((data ?? []) as any[]).map((product) => {
        const existingB2B = product.price_b2b || product.base_price || product.wholesale_price || product.price_per_kg || null;
        return {
          id: product.id ?? null,
          name: product.name ?? null,
          category: product.category ?? null,
          mrp: product.mrp ?? null,
          price_b2b: existingB2B,
          price_horeca: product.price_horeca ?? null,
          price_special: product.price_special ?? null,
        };
      }));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useScopedRealtimeSubscription({
    domain: "products",
    scope: { type: "global_staff" },
    changes: PRODUCTS_UPDATE_CHANGES,
    mode: "refetch",
    snapshot: fetchProducts,
    pollingFallbackMs: 30_000,
  });

  const handleCellSaved = (id: string, field: keyof ProductPriceRow, val: number | null) => {
    setProducts((prev) => prev.map((product) => (product.id === id ? { ...product, [field]: val } : product)));
  };

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        product.name?.toLowerCase().includes(query) ||
        product.category?.toLowerCase().includes(query);

      if (!matchesSearch) return false;
      if (!showMissingOnly) return true;

      return [product.mrp, product.price_b2b, product.price_horeca, product.price_special].some(
        (price) => price === null || price === undefined || price === 0,
      );
    });
  }, [products, searchQuery, showMissingOnly]);

  const calcBulk = (mrp: number | null) => (mrp && mrp > 0 ? (mrp * 0.8).toFixed(0) : "—");
  const calcWholesale = (mrp: number | null) => (mrp && mrp > 0 ? (mrp * 0.7).toFixed(0) : "—");

  console.log("Rendering Matrix. Total Products:", products.length, "Filtered:", filteredProducts.length);

  return (
    <div className="min-h-screen pb-8 font-sans">
      <div className="space-y-6">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-primary">Finance Control</p>
            <h1 className="text-3xl font-serif tracking-tight text-foreground md:text-4xl">Pricing Matrix</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {products.length} products · {filteredProducts.length} visible · Changes save automatically on blur
            </p>
          </div>

          <div className="flex w-full items-center gap-3 md:w-auto">
            <button
              onClick={() => setShowMissingOnly((current) => !current)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                showMissingOnly
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-input bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <AlertTriangle size={14} />
              {showMissingOnly ? "Missing Only" : "Show All"}
            </button>

            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Search product or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl border-input"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full border-collapse text-left">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-4 pl-6 text-[10px] font-bold uppercase tracking-widest text-primary">Product</th>
                  <th className="p-4 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    MRP (₹)
                  </th>
                  <th className="bg-accent/20 p-4 text-right text-[10px] font-bold uppercase tracking-widest text-primary">
                    Calc. Bulk (−20%)
                  </th>
                  <th className="bg-accent/20 p-4 text-right text-[10px] font-bold uppercase tracking-widest text-primary">
                    Calc. Wholesale (−30%)
                  </th>
                  <th className="p-4 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    HoReCa (₹)
                  </th>
                  <th className="p-4 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    B2B (₹)
                  </th>
                  <th className="p-4 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Special (₹)
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center">
                      <Loader2 className="mx-auto animate-spin text-primary" size={24} />
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-muted-foreground">
                      {showMissingOnly ? "All products have pricing data ✓" : "No products found."}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const hasMissing = [product.mrp, product.price_b2b, product.price_horeca, product.price_special].some(
                      (price) => price === null || price === undefined || price === 0,
                    );

                    return (
                      <tr
                        key={product.id || Math.random().toString()}
                        className={hasMissing ? "bg-accent/10" : "bg-background"}
                      >
                        <td className="p-4 pl-6">
                          <p className="text-sm font-bold leading-tight text-foreground">{product.name || "Unnamed"}</p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">{product.category || "—"}</p>
                        </td>

                        <td className="p-4">
                          {product.id ? (
                            <PriceCell productId={product.id} field="mrp" value={product.mrp ?? null} onSaved={handleCellSaved} />
                          ) : (
                            <div className="text-right text-sm text-muted-foreground">—</div>
                          )}
                        </td>

                        <td className="bg-accent/10 p-4">
                          <div className="flex h-9 w-24 items-center justify-end px-2 text-right text-sm font-medium text-foreground">
                            {calcBulk(product.mrp ?? null)}
                          </div>
                        </td>

                        <td className="bg-accent/10 p-4">
                          <div className="flex h-9 w-24 items-center justify-end px-2 text-right text-sm font-medium text-foreground">
                            {calcWholesale(product.mrp ?? null)}
                          </div>
                        </td>

                        <td className="p-4">
                          {product.id ? (
                            <PriceCell
                              productId={product.id}
                              field="price_horeca"
                              value={product.price_horeca ?? null}
                              onSaved={handleCellSaved}
                            />
                          ) : (
                            <div className="text-right text-sm text-muted-foreground">—</div>
                          )}
                        </td>

                        <td className="p-4">
                          {product.id ? (
                            <PriceCell
                              productId={product.id}
                              field="price_b2b"
                              value={product.price_b2b ?? null}
                              onSaved={handleCellSaved}
                            />
                          ) : (
                            <div className="text-right text-sm text-muted-foreground">—</div>
                          )}
                        </td>

                        <td className="p-4">
                          {product.id ? (
                            <PriceCell
                              productId={product.id}
                              field="price_special"
                              value={product.price_special ?? null}
                              onSaved={handleCellSaved}
                            />
                          ) : (
                            <div className="text-right text-sm text-muted-foreground">—</div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPricing;
