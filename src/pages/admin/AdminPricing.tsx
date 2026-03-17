import { Loader2 } from "lucide-react";

const AdminPricing = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-display-h2 text-foreground">Pricing Matrix</h1>
      <p className="text-body-p2 text-muted-foreground">Slab pricing, customer pricing map, special overrides, versioning</p>

      <div className="bg-card border border-border rounded-xl p-8 text-center" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
        <p className="text-ui-label text-muted-foreground">
          Pricing matrix management will be wired to a dedicated pricing table. Structure is ready for slab-based, customer-specific, and product-specific pricing with version history.
        </p>
      </div>
    </div>
  );
};

export default AdminPricing;
