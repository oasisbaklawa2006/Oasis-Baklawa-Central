import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Loader2,
  Package,
  Plus,
  Edit2,
  Power,
  PowerOff,
  Image as ImageIcon,
  X,
  UploadCloud,
  Sparkles,
  Info,
  Wand2,
  Calculator,
  Leaf,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku?: string | null;
  category?: string | null;
  sub_category?: string | null;
  department?: string | null;
  price_per_kg?: number | null;
  pack_size?: string | null;
  carton_type?: string | null;
  storage_type?: string | null;
  description?: string | null;
  shelf_life?: string | null;
  image_url?: string | null;
  is_active: boolean;
  created_at?: string;

  mrp?: number | null;
  wholesale_price?: number | null;
  weight_per_pc_grams?: number | null;
  net_weight_grams?: number | null;
  moq?: number | null;
  packs_per_master_carton?: number | null;
  hsn_code?: string | null;
  gst_percentage?: number | null;
  dietary_tags?: string[] | null;

  uom?: string | null;
  private_label_moq?: number | null;
  private_label_price?: number | null;
  nutrition_facts?: string | null;
}

const CATEGORIES = [
  "Bulk Sweets & Nuts",
  "Ready packs",
  "Premium Gift Packs",
  "Semi-Prepared & Frozen Range",
  "Packaging & Decoration Material",
];

const GST_RATES = [0, 5, 12, 18, 28];
const DIETARY_OPTIONS = ["100% Eggless", "Contains Nuts", "Vegan", "Gluten-Free", "Sugar-Free", "No Preservatives"];
const STORAGE_OPTIONS = ["ambient", "refrigerated", "frozen"];
const DEPARTMENTS = [
  "Bakery Department",
  "Arabic Sweets Department",
  "Confectionery & Chocolates Department",
  "Fusion Sweets Department",
  "Packaging Assembly Department",
  "Nuts Roasting and Coating Department",
  "Packing Material Department",
];

const EMPTY_FORM = {
  name: "",
  sku: "",
  category: CATEGORIES[0],
  sub_category: "",
  department: "",
  price_per_kg: "",
  pack_size: "",
  carton_type: "",
  storage_type: "ambient",
  description: "",
  shelf_life: "90",
  image_url: "",
  is_active: true,
  mrp: "",
  wholesale_price: "",
  weight_per_pc_grams: "",
  net_weight_grams: "",
  moq: "1",
  packs_per_master_carton: "",
  hsn_code: "19059090",
  gst_percentage: "18",
  dietary_tags: ["100% Eggless"],
  uom: "Pack",
  private_label_moq: "",
  private_label_price: "",
  nutrition_facts: "",
};

const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [isAiLoading, setIsAiLoading] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({ ...EMPTY_FORM });

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    if (!error) setProducts((data as Product[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // 1. AUTO-GENERATE SKU
  useEffect(() => {
    if (formData.name && formData.net_weight_grams && !editingProduct) {
      const prefix = formData.name
        .substring(0, 3)
        .toUpperCase()
        .replace(/[^A-Z]/g, "X");
      setFormData((prev: any) => ({ ...prev, sku: `OAS-${prefix}-${prev.net_weight_grams}` }));
    }
  }, [formData.name, formData.net_weight_grams, editingProduct]);

  // 2. AUTO-GENERATE CARTON TYPE
  useEffect(() => {
    const packs = Number(formData.packs_per_master_carton);
    if (packs > 0) {
      let autoCarton = `${packs} Box`;
      if (packs <= 4) autoCarton = `Small Master (${packs} Box)`;
      else if (packs <= 6) autoCarton = `Medium Master (${packs} Box)`;
      else if (packs <= 9) autoCarton = `Large Master (${packs} Box)`;
      else if (packs >= 12) autoCarton = `Jumbo Master (${packs} Box)`;
      setFormData((prev: any) => ({ ...prev, carton_type: autoCarton }));
    } else {
      setFormData((prev: any) => ({ ...prev, carton_type: "" }));
    }
  }, [formData.packs_per_master_carton]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleToggleDietaryTag = (tag: string) => {
    setFormData((prev: any) => ({
      ...prev,
      dietary_tags: prev.dietary_tags.includes(tag)
        ? prev.dietary_tags.filter((t: string) => t !== tag)
        : [...prev.dietary_tags, tag],
    }));
  };

  // AI GENERATORS
  const handleAiDescription = async () => {
    if (!formData.name) return toast.error("Enter Product Name first.");
    setIsAiLoading("desc");
    await new Promise((r) => setTimeout(r, 1500));
    setFormData((prev: any) => ({
      ...prev,
      description: `A premium, handcrafted ${formData.name} made with the finest ingredients. Perfect for luxury gifting and high-end retail, maintaining authentic flavors and a crisp texture. Delivered in standard wholesale packaging ensuring maximum freshness.`,
    }));
    toast.success("AI Description Generated!", { icon: "✨" });
    setIsAiLoading(null);
  };

  const handleAiNutrition = async () => {
    if (!formData.name) return toast.error("Enter Product Name first.");
    setIsAiLoading("nutrition");
    await new Promise((r) => setTimeout(r, 1500));
    const fssaiTable = `NUTRITIONAL INFORMATION (Per 100g)\n-----------------------------------\nEnergy: 480 kcal (24% DV)\nProtein: 8.5g (17% DV)\nTotal Fat: 22g (33% DV)\n - Saturated Fat: 8g (40% DV)\nCarbohydrates: 62g (20% DV)\n - Total Sugars: 38g\n - Added Sugars: 25g (50% DV)\nSodium: 45mg (2% DV)\n\n*Percent Daily Values (DV) are based on FSSAI guidelines for a 2000 calorie diet.`;
    setFormData((prev: any) => ({ ...prev, nutrition_facts: fssaiTable }));
    toast.success("FSSAI Nutrition Table Generated!", { icon: "✨" });
    setIsAiLoading(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      setUploadingImage(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
      setFormData((prev: any) => ({ ...prev, image_url: publicUrlData.publicUrl }));
      toast.success("Image uploaded successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const openPanel = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name || "",
        sku: product.sku || "",
        category: product.category || CATEGORIES[0],
        sub_category: product.sub_category || "",
        department: product.department || "",
        price_per_kg: product.price_per_kg?.toString() || "",
        pack_size: product.pack_size || "",
        carton_type: product.carton_type || "",
        storage_type: product.storage_type || "ambient",
        description: product.description || "",
        shelf_life: product.shelf_life || "",
        image_url: product.image_url || "",
        is_active: product.is_active ?? true,
        mrp: product.mrp?.toString() || "",
        wholesale_price: product.wholesale_price?.toString() || "",
        weight_per_pc_grams: product.weight_per_pc_grams?.toString() || "",
        net_weight_grams: product.net_weight_grams?.toString() || "",
        moq: product.moq?.toString() || "1",
        packs_per_master_carton: product.packs_per_master_carton?.toString() || "",
        hsn_code: product.hsn_code || "19059090",
        gst_percentage: product.gst_percentage?.toString() || "18",
        dietary_tags: product.dietary_tags || ["100% Eggless"],
        uom: product.uom || "Pack",
        private_label_moq: product.private_label_moq?.toString() || "",
        private_label_price: product.private_label_price?.toString() || "",
        nutrition_facts: product.nutrition_facts || "",
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
    if (!formData.name || !formData.wholesale_price) return toast.error("Name and Wholesale Price are required");
    setSaving(true);

    const payload = {
      name: formData.name,
      sku: formData.sku || null,
      category: formData.category || null,
      sub_category: formData.sub_category || null,
      department: formData.department || null,
      pack_size: formData.pack_size || null,
      carton_type: formData.carton_type || null,
      storage_type: formData.storage_type || null,
      description: formData.description || null,
      image_url: formData.image_url || null,
      hsn_code: formData.hsn_code || null,
      dietary_tags: formData.dietary_tags || [],
      is_active: formData.is_active,
      shelf_life: formData.shelf_life || null,
      price_per_kg: parseFloat(formData.price_per_kg) || null,
      mrp: parseFloat(formData.mrp) || null,
      wholesale_price: parseFloat(formData.wholesale_price) || null,
      weight_per_pc_grams: parseFloat(formData.weight_per_pc_grams) || null,
      net_weight_grams: parseFloat(formData.net_weight_grams) || null,
      moq: parseInt(formData.moq) || 1,
      packs_per_master_carton: parseInt(formData.packs_per_master_carton) || null,
      gst_percentage: parseInt(formData.gst_percentage) || 0,
      uom: formData.uom || "Pack",
      private_label_moq: parseInt(formData.private_label_moq) || null,
      private_label_price: parseFloat(formData.private_label_price) || null,
      nutrition_facts: formData.nutrition_facts || null,
    };

    try {
      if (editingProduct) {
        const { error } = await (supabase as any).from("products").update(payload).eq("id", editingProduct.id);
        if (error) throw error;
        toast.success("Product updated successfully");
      } else {
        const { error } = await (supabase as any).from("products").insert([payload]);
        if (error) throw error;
        toast.success("New product added to catalog!");
      }
      closePanel();
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const toggleActiveStatus = async (product: Product) => {
    const newStatus = !product.is_active;
    const { error } = await supabase.from("products").update({ is_active: newStatus }).eq("id", product.id);
    if (!error) {
      toast.success(`${product.name} is now ${newStatus ? "Active" : "Hidden"}`);
      fetchProducts();
    }
  };

  if (loading)
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  const activeCount = products.filter((p) => p.is_active).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Product Catalog</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage wholesale inventory, logistics, and pricing.</p>
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
              className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 shadow-sm"
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
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {products.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-card border border-border rounded-xl overflow-hidden group shadow-sm"
              >
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
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-semibold text-foreground text-sm leading-snug truncate">{product.name}</h3>
                    {product.wholesale_price && (
                      <p className="text-primary font-bold text-sm tabular-nums shrink-0">₹{product.wholesale_price}</p>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground font-mono">SKU: {product.sku || "N/A"}</p>
                    <p className="text-xs text-muted-foreground">Carton: {product.carton_type || "N/A"}</p>
                    <p className="text-xs text-muted-foreground">
                      MOQ: {product.moq || 1} {product.uom || "packs"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                    <button
                      onClick={() => toggleActiveStatus(product)}
                      className={`flex-1 text-xs font-semibold py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors ${product.is_active ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20" : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"}`}
                    >
                      {product.is_active ? <PowerOff size={12} /> : <Power size={12} />}{" "}
                      {product.is_active ? "Hide" : "Activate"}
                    </button>
                    <button
                      onClick={() => openPanel(product)}
                      className="flex-1 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors"
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
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={closePanel}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 z-50 h-full w-full max-w-2xl bg-background border-l border-border shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-border bg-card">
                <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                  <Package className="text-primary" size={20} /> {editingProduct ? "Edit Product" : "Build Product"}
                </h2>
                <button onClick={closePanel} className="p-1.5 rounded-md hover:bg-muted transition-colors">
                  <X size={18} className="text-muted-foreground" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* 1. IDENTITY & VISUALS */}
                <section className="space-y-4">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-2 flex items-center gap-2">
                    <ImageIcon size={14} className="text-primary" /> 1. Identity & Visuals
                  </h3>

                  {/* Image Upload */}
                  <div className="mt-2 flex items-center gap-4">
                    {formData.image_url ? (
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border flex-shrink-0 bg-muted/30">
                        <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFormData((prev: any) => ({ ...prev, image_url: "" }))}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg border border-dashed border-border bg-muted/10 flex items-center justify-center flex-shrink-0">
                        <ImageIcon size={20} className="text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <label
                        className={`flex flex-1 items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border bg-background cursor-pointer hover:bg-muted/50 text-xs font-semibold ${uploadingImage ? "opacity-50 pointer-events-none" : ""}`}
                      >
                        {uploadingImage ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}{" "}
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
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Product Name *</label>
                      <input
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex justify-between">
                        SKU Code <span className="text-primary">Auto</span>
                      </label>
                      <input
                        name="sku"
                        value={formData.sku}
                        readOnly
                        className="w-full bg-muted/30 border border-border rounded-lg p-2.5 text-sm text-foreground outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                        Category
                      </label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                        Sub-Category
                      </label>
                      <input
                        name="sub_category"
                        placeholder="e.g. Classic Baklawa"
                        value={formData.sub_category}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                        Production Allocation
                      </label>
                      <select
                        name="department"
                        value={formData.department}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">— Select Department —</option>
                        {DEPARTMENTS.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <div className="flex justify-between items-end mb-1.5">
                        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                          Description
                        </label>
                        <button
                          onClick={handleAiDescription}
                          disabled={isAiLoading === "desc"}
                          className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          {isAiLoading === "desc" ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            <Wand2 size={10} />
                          )}{" "}
                          Auto-Generate
                        </button>
                      </div>
                      <textarea
                        name="description"
                        rows={3}
                        value={formData.description}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary resize-none"
                      />
                    </div>
                  </div>
                </section>

                {/* 2. COMMERCIALS & LOGISTICS (Unit Economics Calculator) */}
                <section className="space-y-4">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-2 flex items-center gap-2">
                    <Calculator size={14} className="text-primary" /> 2. Commercials & Logistics
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                        Unit of Measure
                      </label>
                      <select
                        name="uom"
                        value={formData.uom}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="Kg">Kg</option>
                        <option value="Pack">Pack</option>
                        <option value="Piece">Piece</option>
                        <option value="Box">Box</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                        Printed MRP (₹) *
                      </label>
                      <input
                        type="number"
                        name="mrp"
                        value={formData.mrp}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-primary uppercase mb-1.5">
                        B2B Base (₹) *
                      </label>
                      <input
                        type="number"
                        name="wholesale_price"
                        value={formData.wholesale_price}
                        onChange={handleInputChange}
                        className="w-full bg-primary/10 border border-primary/30 text-foreground rounded-lg p-2.5 font-bold outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                        Avg Wt / Pack (g)
                      </label>
                      <input
                        type="number"
                        name="net_weight_grams"
                        value={formData.net_weight_grams}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                        Avg Wt / Pc (g)
                      </label>
                      <input
                        type="number"
                        name="weight_per_pc_grams"
                        value={formData.weight_per_pc_grams}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                        Packs / Carton
                      </label>
                      <input
                        type="number"
                        name="packs_per_master_carton"
                        value={formData.packs_per_master_carton}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                        GST Rate (%)
                      </label>
                      <select
                        name="gst_percentage"
                        value={formData.gst_percentage}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                      >
                        {GST_RATES.map((rate) => (
                          <option key={rate} value={rate}>
                            {rate}%
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-primary uppercase mb-1.5 flex items-center gap-1">
                        MOQ (in {formData.uom}s) <Info size={12} />
                      </label>
                      <input
                        type="number"
                        name="moq"
                        value={formData.moq}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-primary/50 text-foreground rounded-lg p-2.5 font-bold outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                        Carton Type (Auto)
                      </label>
                      <input
                        name="carton_type"
                        value={formData.carton_type}
                        readOnly
                        className="w-full bg-muted/30 border border-border rounded-lg p-2.5 text-sm text-muted-foreground outline-none"
                      />
                    </div>
                  </div>

                  {/* Live Economics Summary */}
                  {Number(formData.mrp) > 0 && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mt-4">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">
                        Live Unit Economics
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Bulk (-20%)</p>
                          <p className="text-sm font-bold text-foreground">
                            ₹{(Number(formData.mrp) * 0.8).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Wholesale (-30%)</p>
                          <p className="text-sm font-bold text-foreground">
                            ₹{(Number(formData.mrp) * 0.7).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Cost / Piece</p>
                          <p className="text-sm font-bold text-foreground">
                            {Number(formData.net_weight_grams) > 0 && Number(formData.weight_per_pc_grams) > 0
                              ? `₹${(Number(formData.mrp) / (Number(formData.net_weight_grams) / Number(formData.weight_per_pc_grams))).toFixed(2)}`
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                {/* 3. CONDITIONAL: PRIVATE LABEL */}
                {formData.category === "Ready packs" && (
                  <section className="space-y-4">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-2 flex items-center gap-2">
                      <Package size={14} className="text-primary" /> 3. Private Label Config
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                          MOQ for Private Label
                        </label>
                        <input
                          type="number"
                          name="private_label_moq"
                          value={formData.private_label_moq}
                          onChange={handleInputChange}
                          placeholder="e.g. 500"
                          className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                          Cost Per Unit (Label) ₹
                        </label>
                        <input
                          type="number"
                          name="private_label_price"
                          value={formData.private_label_price}
                          onChange={handleInputChange}
                          placeholder="e.g. 15"
                          className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </section>
                )}

                {/* 4. FOOD COMPLIANCE */}
                <section className="space-y-4">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-2 flex items-center gap-2">
                    <Leaf size={14} className="text-green-600" /> 4. Food Compliance
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                        Shelf Life (Days)
                      </label>
                      <input
                        name="shelf_life"
                        value={formData.shelf_life}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                        Storage Type
                      </label>
                      <select
                        name="storage_type"
                        value={formData.storage_type}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                      >
                        {STORAGE_OPTIONS.map((opt) => (
                          <option key={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-2">
                        Dietary Tags
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {DIETARY_OPTIONS.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleToggleDietaryTag(tag)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors border ${formData.dietary_tags.includes(tag) ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted"}`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="flex justify-between items-end mb-1.5">
                        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                          FSSAI Nutrition Panel
                        </label>
                        <button
                          onClick={handleAiNutrition}
                          disabled={isAiLoading === "nutrition"}
                          className="text-[10px] font-bold text-green-600 hover:underline flex items-center gap-1"
                        >
                          {isAiLoading === "nutrition" ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            <Wand2 size={10} />
                          )}{" "}
                          Generate Table
                        </button>
                      </div>
                      <textarea
                        name="nutrition_facts"
                        rows={5}
                        value={formData.nutrition_facts}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-xs font-mono outline-none focus:ring-1 focus:ring-primary resize-none"
                        placeholder="Nutrition details per 100g..."
                      />
                    </div>
                  </div>
                </section>

                {/* Active Toggle */}
                <div className="flex items-center gap-3 bg-muted/20 p-4 rounded-xl border border-border mt-4">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="is_active" className="text-sm font-semibold text-foreground cursor-pointer">
                    Product is Active (Visible to Buyers)
                  </label>
                </div>
              </div>

              {/* Panel Footer */}
              <div className="p-6 border-t border-border bg-card flex justify-end gap-3 shrink-0">
                <button
                  onClick={closePanel}
                  className="px-5 py-2.5 rounded-lg font-semibold text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProduct}
                  disabled={saving || uploadingImage}
                  className="px-6 py-2.5 rounded-lg font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2 active:scale-[0.97] disabled:opacity-50"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}{" "}
                  {editingProduct ? "Save Changes" : "Publish Product"}
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
