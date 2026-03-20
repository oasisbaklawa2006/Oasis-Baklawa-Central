import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Loader2, Package, Plus, Edit2, Power, PowerOff, Image as ImageIcon, X, UploadCloud } from "lucide-react";

interface Product {
  id: string;
  name: string;
  category_id?: string | null;
  price_per_kg: number;
  pack_size?: string | null;
  carton_type?: string | null;
  storage_type?: string | null;
  description?: string | null;
  shelf_life?: string | null;
  image_url?: string | null;
  is_active: boolean;
  created_at?: string;
}

type ProductForm = Omit<Product, "id" | "created_at">;

const EMPTY_FORM: ProductForm = {
  name: "",
  price_per_kg: 0,
  pack_size: "",
  carton_type: "",
  storage_type: "ambient",
  description: "",
  shelf_life: "",
  image_url: "",
  is_active: true,
};

const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState<ProductForm>({ ...EMPTY_FORM });

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    if (!error) setProducts((data as Product[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "price_per_kg" ? parseFloat(value) || 0 : value,
    }));
  };

  // NEW: Handle Supabase Image Upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;

      const file = e.target.files[0];
      setUploadingImage(true);

      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from("product-images").upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("product-images").getPublicUrl(filePath);

      setFormData((prev) => ({ ...prev, image_url: publicUrlData.publicUrl }));
      toast.success("Image uploaded successfully!");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const openPanel = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        price_per_kg: product.price_per_kg,
        pack_size: product.pack_size ?? "",
        carton_type: product.carton_type ?? "",
        storage_type: product.storage_type ?? "",
        description: product.description ?? "",
        shelf_life: product.shelf_life ?? "",
        image_url: product.image_url ?? "",
        is_active: product.is_active ?? true,
        category_id: product.category_id,
      });
    } else {
      setEditingProduct(null);
      setFormData({ ...EMPTY_FORM });
    }
    setIsPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    setTimeout(() => setEditingProduct(null), 300);
  };

  const handleSaveProduct = async () => {
    if (!formData.name || !formData.price_per_kg) {
      toast.error("Name and Price per KG are required");
      return;
    }
    setSaving(true);
    const payload = {
      name: formData.name,
      price_per_kg: formData.price_per_kg,
      pack_size: formData.pack_size || null,
      carton_type: formData.carton_type || null,
      storage_type: formData.storage_type || null,
      description: formData.description || null,
      shelf_life: formData.shelf_life || null,
      image_url: formData.image_url || null,
      is_active: formData.is_active,
      category_id: formData.category_id || null,
    };

    if (editingProduct) {
      const { error } = await supabase.from("products").update(payload).eq("id", editingProduct.id);
      if (error) {
        toast.error("Failed to update product");
        console.error(error);
      } else {
        toast.success("Product updated");
        closePanel();
        await fetchProducts();
      }
    } else {
      const { error } = await supabase.from("products").insert([payload]);
      if (error) {
        toast.error("Failed to add product");
        console.error(error);
      } else {
        toast.success("Product added");
        closePanel();
        await fetchProducts();
      }
    }
    setSaving(false);
  };

  const toggleActiveStatus = async (product: Product) => {
    const newStatus = !product.is_active;
    const { error } = await supabase.from("products").update({ is_active: newStatus }).eq("id", product.id);
    if (!error) {
      toast.success(`${product.name} is now ${newStatus ? "Active" : "Hidden"}`);
      await fetchProducts();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  const activeCount = products.filter((p) => p.is_active).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Product Catalog</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your wholesale inventory and pricing</p>
          </div>
          <button
            onClick={() => openPanel()}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm active:scale-[0.97]"
          >
            <Plus size={16} /> Add New Product
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Products", value: products.length, icon: Package },
            { label: "Active (In Stock)", value: activeCount, icon: Power },
            { label: "Hidden (Out of Stock)", value: products.length - activeCount, icon: PowerOff },
          ].map((kpi) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-5 flex items-center gap-4"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
            >
              <kpi.icon size={20} className="text-primary" />
              <div>
                <p className="text-xl font-bold text-foreground tabular-nums">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Product Grid */}
        {products.length === 0 ? (
          <div className="text-center py-20">
            <Package size={40} className="mx-auto text-muted-foreground/40" />
            <p className="text-lg font-semibold text-foreground mt-4">No products found</p>
            <p className="text-sm text-muted-foreground mt-1">Your catalog is currently empty.</p>
            <button onClick={() => openPanel()} className="mt-6 text-primary font-semibold text-sm hover:underline">
              Add your first product
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {products.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.4 }}
                className="bg-card border border-border rounded-xl overflow-hidden group"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
              >
                {/* Image */}
                <div className="relative h-40 bg-muted/30 flex items-center justify-center overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <ImageIcon size={32} className="text-muted-foreground/30" />
                  )}
                  {!product.is_active && (
                    <span className="absolute top-2 right-2 bg-destructive/90 text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded">
                      Hidden
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="p-4 space-y-3">
                  <h3 className="font-semibold text-foreground text-sm leading-snug truncate">{product.name}</h3>
                  <p className="text-primary font-bold text-sm tabular-nums">₹{product.price_per_kg} / kg</p>

                  <div className="space-y-0.5">
                    {product.pack_size && <p className="text-xs text-muted-foreground">Pack: {product.pack_size}</p>}
                    {product.shelf_life && (
                      <p className="text-xs text-muted-foreground">Shelf Life: {product.shelf_life}</p>
                    )}
                    {product.storage_type && (
                      <p className="text-xs text-muted-foreground">Storage: {product.storage_type}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => toggleActiveStatus(product)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
                        product.is_active
                          ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      {product.is_active ? <PowerOff size={12} /> : <Power size={12} />}
                      {product.is_active ? "Hide" : "Activate"}
                    </button>
                    <button
                      onClick={() => openPanel(product)}
                      className="text-xs font-semibold bg-muted/50 hover:bg-muted text-foreground px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors"
                    >
                      <Edit2 size={12} /> Edit
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Slide-out Panel */}
      <AnimatePresence>
        {isPanelOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50"
              onClick={closePanel}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 z-50 h-full w-full max-w-lg bg-background border-l border-border shadow-2xl flex flex-col"
            >
              {/* Panel Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <h2 className="text-lg font-bold text-foreground">
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </h2>
                <button onClick={closePanel} className="p-1.5 rounded-md hover:bg-muted transition-colors">
                  <X size={18} className="text-muted-foreground" />
                </button>
              </div>

              {/* Panel Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* NEW: Image Uploader */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Product Image
                  </label>
                  <div className="mt-2 flex items-center gap-4">
                    {/* Preview Bubble */}
                    {formData.image_url ? (
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border flex-shrink-0 bg-muted/30">
                        <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, image_url: "" }))}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg border border-dashed border-border bg-muted/10 flex items-center justify-center flex-shrink-0">
                        <ImageIcon size={20} className="text-muted-foreground/40" />
                      </div>
                    )}

                    {/* Upload Buttons */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {/* File Upload Button */}
                        <label
                          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border bg-background cursor-pointer hover:bg-muted/50 transition-colors text-xs font-semibold text-foreground ${uploadingImage ? "opacity-50 pointer-events-none" : ""}`}
                        >
                          {uploadingImage ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                          {uploadingImage ? "Uploading..." : "Upload File"}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                            disabled={uploadingImage}
                          />
                        </label>
                      </div>

                      {/* URL Fallback */}
                      <input
                        name="image_url"
                        value={formData.image_url ?? ""}
                        onChange={handleInputChange}
                        placeholder="...or paste an image URL"
                        className="w-full px-3 py-1.5 rounded-md border border-border bg-muted/10 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                </div>

                <hr className="border-border" />

                {/* Basic Info */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Product Name *
                    </label>
                    <input
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="e.g. Premium Pistachio Baklawa"
                      className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Price per KG (₹) *
                      </label>
                      <input
                        name="price_per_kg"
                        type="number"
                        value={formData.price_per_kg}
                        onChange={handleInputChange}
                        className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Pack Size
                      </label>
                      <input
                        name="pack_size"
                        value={formData.pack_size ?? ""}
                        onChange={handleInputChange}
                        placeholder="e.g. 250g"
                        className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                </div>

                <hr className="border-border" />

                {/* Logistics */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Carton Type
                      </label>
                      <input
                        name="carton_type"
                        value={formData.carton_type ?? ""}
                        onChange={handleInputChange}
                        placeholder="e.g. 9-pack"
                        className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Storage Type
                      </label>
                      <select
                        name="storage_type"
                        value={formData.storage_type ?? ""}
                        onChange={handleInputChange}
                        className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <option value="">Select...</option>
                        <option value="ambient">Ambient (Room Temp)</option>
                        <option value="refrigerated">Refrigerated</option>
                        <option value="frozen">Frozen</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Shelf Life
                    </label>
                    <input
                      name="shelf_life"
                      value={formData.shelf_life ?? ""}
                      onChange={handleInputChange}
                      placeholder="e.g. 90 days"
                      className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                <hr className="border-border" />

                {/* Details */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description ?? ""}
                      onChange={handleInputChange}
                      rows={3}
                      placeholder="Brief product description..."
                      className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-3 bg-muted/20 p-4 rounded-xl border border-border">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <label htmlFor="is_active" className="text-sm font-semibold text-foreground cursor-pointer">
                      Product is Active (In Stock)
                    </label>
                  </div>
                </div>
              </div>

              {/* Panel Footer */}
              <div className="p-6 border-t border-border bg-background flex justify-end gap-3">
                <button
                  onClick={closePanel}
                  className="px-5 py-2.5 rounded-lg font-semibold text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProduct}
                  disabled={saving || uploadingImage}
                  className="px-6 py-2.5 rounded-lg font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2 active:scale-[0.97] disabled:opacity-50"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {editingProduct ? "Save Changes" : "Create Product"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminProducts;
