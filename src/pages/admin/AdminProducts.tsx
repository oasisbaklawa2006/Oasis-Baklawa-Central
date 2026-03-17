import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package } from "lucide-react";

interface Product {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  pack_size: string | null;
  carton_type: string | null;
  price_per_kg: number;
  shelf_life: string | null;
  storage_type: string | null;
  image_url: string | null;
}

const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("products").select("*").order("name");
      setProducts((data as Product[]) ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-display-h2 text-foreground">Product Catalog</h1>
      <p className="text-body-p2 text-muted-foreground">SKU master, categories, pack sizes, carton mapping</p>

      {products.length === 0 ? (
        <p className="text-ui-label text-muted-foreground py-8">No products in catalog.</p>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Product</th>
                  <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Pack Size</th>
                  <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Carton Type</th>
                  <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">Price/kg</th>
                  <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Shelf Life</th>
                  <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Storage</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.image_url ? <img src={p.image_url} alt={p.name} className="w-8 h-8 rounded object-cover" /> : <Package size={16} className="text-muted-foreground" />}
                        <div>
                          <span className="text-ui-cell text-foreground">{p.name}</span>
                          {p.description && <p className="text-fine text-muted-foreground truncate max-w-[200px]">{p.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ui-cell text-muted-foreground">{p.pack_size || "—"}</td>
                    <td className="px-4 py-3 text-ui-cell text-muted-foreground">{p.carton_type || "—"}</td>
                    <td className="px-4 py-3 text-ui-cell text-foreground text-right">₹{p.price_per_kg}</td>
                    <td className="px-4 py-3 text-ui-cell text-muted-foreground">{p.shelf_life || "—"}</td>
                    <td className="px-4 py-3 text-ui-cell text-muted-foreground">{p.storage_type || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProducts;
