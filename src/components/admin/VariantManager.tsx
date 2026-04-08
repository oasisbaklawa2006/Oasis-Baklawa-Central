import { Plus, Trash2 } from "lucide-react";

export interface ProductVariant {
  id?: string;
  variant_name: string;
  price: number;
  moq: number;
  sku: string;
  is_active: boolean;
}

interface VariantManagerProps {
  variants: ProductVariant[];
  onChange: (variants: ProductVariant[]) => void;
}

const VariantManager = ({ variants, onChange }: VariantManagerProps) => {
  const addVariant = () => {
    onChange([...variants, { variant_name: "", price: 0, moq: 1, sku: "", is_active: true }]);
  };

  const updateVariant = (index: number, field: keyof ProductVariant, value: any) => {
    onChange(variants.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  };

  const removeVariant = (index: number) => {
    onChange(variants.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {variants.map((v, idx) => (
        <div key={idx} className="bg-muted/20 p-3 rounded-lg border border-border">
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-4">
              <label className="block text-[9px] font-semibold text-muted-foreground uppercase mb-1">Variant Name *</label>
              <input
                value={v.variant_name}
                onChange={(e) => updateVariant(idx, "variant_name", e.target.value)}
                placeholder="e.g. 500g Pack"
                className="w-full bg-background border border-border rounded-md p-2 text-xs outline-none focus:ring-1 focus:ring-[#C5A059]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[9px] font-semibold text-muted-foreground uppercase mb-1">Price (₹) *</label>
              <input
                type="number"
                value={v.price || ""}
                onChange={(e) => updateVariant(idx, "price", parseFloat(e.target.value) || 0)}
                className="w-full bg-background border border-border rounded-md p-2 text-xs outline-none focus:ring-1 focus:ring-[#C5A059]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[9px] font-semibold text-muted-foreground uppercase mb-1">MOQ</label>
              <input
                type="number"
                value={v.moq || ""}
                onChange={(e) => updateVariant(idx, "moq", parseInt(e.target.value) || 1)}
                className="w-full bg-background border border-border rounded-md p-2 text-xs outline-none focus:ring-1 focus:ring-[#C5A059]"
              />
            </div>
            <div className="col-span-3">
              <label className="block text-[9px] font-semibold text-muted-foreground uppercase mb-1">SKU</label>
              <input
                value={v.sku}
                onChange={(e) => updateVariant(idx, "sku", e.target.value)}
                placeholder="OAS-VAR-001"
                className="w-full bg-background border border-border rounded-md p-2 text-xs outline-none focus:ring-1 focus:ring-[#C5A059]"
              />
            </div>
            <div className="col-span-1 flex justify-center">
              <button
                type="button"
                onClick={() => removeVariant(idx)}
                className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addVariant}
        className="flex items-center gap-2 text-xs font-bold text-[#C5A059] hover:text-[#B38F48] py-2"
      >
        <Plus size={14} /> Add Variant
      </button>
      {variants.length > 0 && (
        <p className="text-[9px] text-muted-foreground">
          {variants.length} variant(s) defined. Main price/MOQ fields are hidden when variants are active.
        </p>
      )}
    </div>
  );
};

export default VariantManager;
