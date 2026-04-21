import { useEffect, useState } from "react";
import VariantManager, { type ProductVariant } from "@/components/admin/VariantManager";
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
  Tag,
  Filter,
  Zap,
  Layers,
  Trash2,
  Search,
} from "lucide-react";

interface ProductTagItem {
  id: string;
  tag_key: string;
  tag_label: string;
  is_active: boolean;
}

interface BomComponent {
  id?: string;
  component_product_id?: string | null;
  component_name: string;
  quantity_per_unit: number;
  uom: string;
  source_department: string;
  unit_cost?: number;
}

interface Product {
  id: string;
  name: string;
  sku?: string | null;
  category?: string | null;
  sub_category?: string | null;
  department?: string | null;
  production_department?: string | null;
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
  mrp_per_pc?: number | null;
  wholesale_price?: number | null;
  weight_per_pc_grams?: number | null;
  net_weight_grams?: number | null;
  moq?: number | null;
  packs_per_master_carton?: number | null;
  hsn_code?: string | null;
  gst_percentage?: number | null;
  dietary_tags?: string[] | null;

  uom?: string | null;
  settlement_unit?: string | null;
  private_label_moq?: number | null;
  private_label_price?: number | null;
  nutrition_facts?: string | null;
  allergen_warnings?: string | null;
  ingredients?: string | null;
}

const CATEGORIES = [
  "Bulk Sweets & Nuts",
  "Ready packs",
  "Premium Gift Packs",
  "Premium Packs",
  "Semi-Prepared & Frozen Range",
  "Packaging & Decoration Material",
  "Gifts & Hampers",
];

const GST_RATES = [0, 5, 12, 18, 28];
const DIETARY_OPTIONS = ["100% Eggless", "Contains Nuts", "Vegan", "Gluten-Free", "Sugar-Free", "No Preservatives"];
const STORAGE_OPTIONS = ["ambient", "refrigerated", "frozen"];

const TARGET_DEPARTMENTS = [
  "Arabic Sweets",
  "Chocolates",
  "Bakery",
  "Dragees",
  "Fusion Sweets",
  "Seasoned Nuts",
  "3rd Party Store",
  "Packing & Assembly",
];

const PRODUCTION_DEPARTMENTS = [
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
  production_department: "",
  price_per_kg: "",
  pack_size: "",
  carton_type: "",
  storage_type: "ambient",
  description: "",
  shelf_life: "90",
  image_url: "",
  is_active: true,
  visible_in_catalog: true,
  mrp: "",
  mrp_per_pc: "",
  wholesale_price: "",
  weight_per_pc_grams: "",
  net_weight_grams: "",
  moq: "1",
  packs_per_master_carton: "",
  hsn_code: "19059090",
  gst_percentage: "18",
  dietary_tags: ["100% Eggless"],
  uom: "Kg",
  settlement_unit: "KG",
  private_label_moq: "",
  private_label_price: "",
  nutrition_facts: "",
  allergen_warnings: "",
  ingredients: "",
  has_bom: false,
  enable_variants: false,
  // Category-aware additive fields
  product_family: "bulk_sweets",
  dimensions: "",
  material: "",
  gross_weight_kg: "",
  bom_summary: "",
  // Intelligence & Search (parser/SO math)
  aliases: "" as string, // comma-separated in UI; stored as text[]
  grams_per_piece: "",
  weight_per_box_kg: "",
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

  // BOM state
  const [bomComponents, setBomComponents] = useState<BomComponent[]>([]);
  const [bomSearchQuery, setBomSearchQuery] = useState("");
  const [bomSearchResults, setBomSearchResults] = useState<Product[]>([]);
  const [bomSearchingIdx, setBomSearchingIdx] = useState<number | null>(null);
  // Variant state
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);

  // Tag management state
  const [allTags, setAllTags] = useState<ProductTagItem[]>([]);
  const [tagModalProduct, setTagModalProduct] = useState<Product | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);
  const [filterTag, setFilterTag] = useState<string>("");
  const [taggedProductIds, setTaggedProductIds] = useState<string[]>([]);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    if (!error) setProducts((data as Product[]) ?? []);
    setLoading(false);
  };

  const fetchTags = async () => {
    const { data } = await supabase.from("product_tags").select("*").eq("is_active", true).order("sort_order");
    setAllTags(data || []);
  };

  useEffect(() => {
    fetchProducts();
    fetchTags();
  }, []);

  // When filter tag changes, fetch product IDs for that tag
  useEffect(() => {
    if (!filterTag) { setTaggedProductIds([]); return; }
    const loadFiltered = async () => {
      const { data } = await supabase
        .from("product_tag_mapping")
        .select("product_id")
        .eq("tag_id", filterTag);
      setTaggedProductIds((data || []).map(d => d.product_id).filter(Boolean) as string[]);
    };
    loadFiltered();
  }, [filterTag]);

  const openTagModal = async (product: Product) => {
    setTagModalProduct(product);
    const { data } = await supabase
      .from("product_tag_mapping")
      .select("tag_id")
      .eq("product_id", product.id);
    setSelectedTagIds((data || []).map(d => d.tag_id).filter(Boolean) as string[]);
  };

  const toggleTagSelection = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const saveTagMappings = async () => {
    if (!tagModalProduct) return;
    setSavingTags(true);
    await supabase.from("product_tag_mapping").delete().eq("product_id", tagModalProduct.id);
    if (selectedTagIds.length > 0) {
      const rows = selectedTagIds.map(tag_id => ({
        product_id: tagModalProduct.id,
        tag_id,
      }));
      await supabase.from("product_tag_mapping").insert(rows);
    }
    toast.success(`Tags updated for ${tagModalProduct.name}`);
    setSavingTags(false);
    setTagModalProduct(null);
  };

  // AUTO-GENERATE SKU
  useEffect(() => {
    if (formData.name && formData.net_weight_grams && !editingProduct) {
      const prefix = formData.name
        .substring(0, 3)
        .toUpperCase()
        .replace(/[^A-Z]/g, "X");
      setFormData((prev: any) => ({ ...prev, sku: `OAS-${prefix}-${prev.net_weight_grams}` }));
    }
  }, [formData.name, formData.net_weight_grams, editingProduct]);

  // AUTO-GENERATE CARTON TYPE
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

  // REAL AI: Generate Nutrition, Allergens, HSN, GST, Ingredients
  const handleAiFullGenerate = async () => {
    if (!formData.name) return toast.error("Enter Product Name first.");
    setIsAiLoading("full");
    try {
      const { data, error } = await supabase.functions.invoke("generate-product-attributes", {
        body: {
          productName: formData.name,
          description: formData.description || "",
          category: formData.category || "",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setFormData((prev: any) => ({
        ...prev,
        nutrition_facts: data.nutrition_facts || prev.nutrition_facts,
        allergen_warnings: data.allergen_warnings || prev.allergen_warnings,
        hsn_code: data.hsn_code || prev.hsn_code,
        gst_percentage: data.gst_percentage?.toString() || prev.gst_percentage,
        ingredients: data.ingredients || prev.ingredients,
      }));
      toast.success("AI attributes generated: Nutrition, Allergens, HSN, GST & Ingredients!", { icon: "⚡" });
    } catch (err: any) {
      console.error("AI generation error:", err);
      toast.error(err.message || "AI generation failed. Try again.");
    } finally {
      setIsAiLoading(null);
    }
  };

  // AI ALIAS SUGGESTIONS — uses oasis-ai-chat to propose B2B nicknames for the SKU.
  const handleAiAliases = async () => {
    if (!formData.name) return toast.error("Enter Product Name first.");
    setIsAiLoading("aliases");
    try {
      const prompt = `Suggest 6-10 short, common B2B/WhatsApp shorthand nicknames a wholesale customer might use to order the product "${formData.name}"${formData.category ? ` (category: ${formData.category})` : ""}. Return ONLY a JSON array of lowercase strings, no commentary. Example: ["pyramid","kitta","cashew pyramid"]`;
      const { data, error } = await supabase.functions.invoke("oasis-ai-chat", {
        body: { messages: [{ role: "user", content: prompt }] },
      });
      if (error) throw error;
      const raw = (data?.reply || data?.message || data?.content || "").toString();
      let parsed: string[] = [];
      const m = raw.match(/\[[\s\S]*\]/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { /* fall through */ }
      }
      if (!Array.isArray(parsed) || parsed.length === 0) {
        // Fallback: split by comma / newline
        parsed = raw.split(/[,\n]/).map((s: string) => s.replace(/^[\s"\-•*\d.]+|["\s]+$/g, "").trim()).filter(Boolean);
      }
      const cleaned = parsed.map((s) => String(s).toLowerCase().trim()).filter((s) => s && s.length <= 40);
      const existing = (formData.aliases || "").split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
      const merged = Array.from(new Set([...existing, ...cleaned]));
      setFormData((prev: any) => ({ ...prev, aliases: merged.join(", ") }));
      toast.success(`Suggested ${cleaned.length} aliases — review & save.`, { icon: "✨" });
    } catch (err: any) {
      console.error("AI aliases error:", err);
      toast.error(err.message || "Could not generate aliases.");
    } finally {
      setIsAiLoading(null);
    }
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

  const loadBom = async (productId: string) => {
    const { data } = await supabase
      .from("product_bom")
      .select("*")
      .eq("product_id", productId)
      .order("created_at");
    const components = (data || []).map((d: any) => ({
        id: d.id,
        component_product_id: d.component_product_id,
        component_name: d.component_name || "",
        quantity_per_unit: d.quantity_per_unit || 1,
        uom: d.source_department ? "Gms" : "Pcs",
        source_department: d.source_department || "",
        unit_cost: 0,
      }));
    setBomComponents(components);
    return components;
  };

  const openPanel = async (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name || "",
        sku: product.sku || "",
        category: product.category || CATEGORIES[0],
        sub_category: product.sub_category || "",
        department: product.department || "",
        production_department: product.production_department || "",
        price_per_kg: product.price_per_kg?.toString() || "",
        pack_size: product.pack_size || "",
        carton_type: product.carton_type || "",
        storage_type: product.storage_type || "ambient",
        description: product.description || "",
        shelf_life: product.shelf_life || "",
        image_url: product.image_url || "",
        is_active: product.is_active ?? true,
        visible_in_catalog: (product as any).visible_in_catalog ?? true,
        mrp: product.mrp?.toString() || "",
        mrp_per_pc: product.mrp_per_pc?.toString() || "",
        wholesale_price: product.wholesale_price?.toString() || "",
        weight_per_pc_grams: product.weight_per_pc_grams?.toString() || "",
        net_weight_grams: product.net_weight_grams?.toString() || "",
        moq: product.moq?.toString() || "1",
        packs_per_master_carton: product.packs_per_master_carton?.toString() || "",
        hsn_code: product.hsn_code || "19059090",
        gst_percentage: product.gst_percentage?.toString() || "18",
        dietary_tags: product.dietary_tags || ["100% Eggless"],
        uom: product.uom || "Kg",
        settlement_unit: product.settlement_unit || "KG",
        private_label_moq: product.private_label_moq?.toString() || "",
        private_label_price: product.private_label_price?.toString() || "",
        nutrition_facts: product.nutrition_facts || "",
        allergen_warnings: product.allergen_warnings || "",
        ingredients: product.ingredients || "",
        has_bom: false,
        enable_variants: false,
        product_family: (product as any).product_family || "bulk_sweets",
        dimensions: (product as any).dimensions || "",
        material: (product as any).material || "",
        gross_weight_kg: (product as any).gross_weight_kg?.toString() || "",
        bom_summary: (product as any).bom_summary || "",
        aliases: Array.isArray((product as any).aliases) ? (product as any).aliases.join(", ") : "",
        grams_per_piece: (product as any).grams_per_piece?.toString() || "",
        weight_per_box_kg: (product as any).weight_per_box_kg?.toString() || "",
      });
      const components = await loadBom(product.id);
      // Load variants
      const { data: varData } = await (supabase as any)
        .from("product_variants")
        .select("*")
        .eq("product_id", product.id)
        .order("created_at");
      const loadedVariants = (varData || []).map((v: any) => ({
        id: v.id,
        variant_name: v.variant_name,
        price: v.price,
        moq: v.moq,
        sku: v.sku || "",
        is_active: v.is_active,
      }));
      setProductVariants(loadedVariants);
      setFormData((prev: any) => ({
        ...prev,
        has_bom: components.length > 0,
        enable_variants: loadedVariants.length > 0,
      }));
    } else {
      setEditingProduct(null);
      setFormData({ ...EMPTY_FORM });
      setBomComponents([]);
      setProductVariants([]);
    }
    setIsPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    setTimeout(() => {
      setEditingProduct(null);
      setBomComponents([]);
    }, 300);
  };

  // BOM helpers
  const addBomComponent = () => {
    setBomComponents((prev) => [
      ...prev,
      { component_name: "", quantity_per_unit: 1, uom: "Gms", source_department: "", unit_cost: 0 },
    ]);
  };

  const searchProductsForBom = async (query: string, idx: number) => {
    setBomSearchQuery(query);
    setBomSearchingIdx(idx);
    if (query.length < 2) { setBomSearchResults([]); return; }
    const { data } = await supabase
      .from("products")
      .select("id, name, sku, production_department, settlement_unit, wholesale_price")
      .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
      .limit(8);
    setBomSearchResults((data as Product[]) || []);
  };

  const selectBomProduct = (idx: number, product: Product) => {
    setBomComponents((prev) =>
      prev.map((c, i) =>
        i === idx
          ? {
              ...c,
              component_product_id: product.id,
              component_name: product.name + (product.sku ? ` (${product.sku})` : ""),
              source_department: product.production_department || "",
              unit_cost: product.wholesale_price || 0,
            }
          : c
      )
    );
    setBomSearchQuery("");
    setBomSearchResults([]);
    setBomSearchingIdx(null);
  };
  const updateBomComponent = (index: number, field: keyof BomComponent, value: any) => {
    setBomComponents((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const removeBomComponent = (index: number) => {
    setBomComponents((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveProduct = async () => {
    if (!formData.name || !formData.wholesale_price) return toast.error("Name and B2B Base Price (₹) are required.");
    if (!formData.production_department) return toast.error("Target Department is mandatory for order routing.");
    if (formData.is_active) {
      if (!formData.hsn_code || !formData.hsn_code.trim()) return toast.error("HSN Code is mandatory for Active products.");
      if (!formData.gst_percentage && formData.gst_percentage !== "0") return toast.error("GST Rate is mandatory for Active products.");
    }
    // UNIT MATH ENFORCEMENT: when settling by weight, parser/SO need both conversion factors.
    const fam = (formData.product_family || "").toLowerCase();
    const isFoodFamily = fam === "bulk_sweets" || fam === "retail_pack" || fam === "hampers" || !fam;
    if (formData.is_active && formData.settlement_unit === "KG" && isFoodFamily) {
      if (!formData.grams_per_piece || Number(formData.grams_per_piece) <= 0) {
        return toast.error("Grams per Piece is mandatory when Settlement Unit is Weight (KG).");
      }
      if (!formData.weight_per_box_kg || Number(formData.weight_per_box_kg) <= 0) {
        return toast.error("Kg per Box is mandatory when Settlement Unit is Weight (KG).");
      }
    }
    setSaving(true);

    const payload: any = {
      name: formData.name,
      sku: formData.sku || null,
      category: formData.category || null,
      sub_category: formData.sub_category || null,
      department: formData.department || null,
      production_department: formData.production_department || null,
      pack_size: formData.pack_size || null,
      carton_type: formData.carton_type || null,
      storage_type: formData.storage_type || null,
      description: formData.description || null,
      image_url: formData.image_url || null,
      hsn_code: formData.hsn_code || null,
      dietary_tags: formData.dietary_tags || [],
      is_active: formData.is_active,
      visible_in_catalog: formData.visible_in_catalog ?? true,
      shelf_life: formData.shelf_life || null,
      price_per_kg: parseFloat(formData.price_per_kg) || null,
      mrp: parseFloat(formData.mrp) || null,
      mrp_per_pc: parseFloat(formData.mrp_per_pc) || null,
      wholesale_price: parseFloat(formData.wholesale_price) || null,
      weight_per_pc_grams: parseFloat(formData.weight_per_pc_grams) || null,
      net_weight_grams: parseFloat(formData.net_weight_grams) || null,
      moq: parseInt(formData.moq) || 1,
      packs_per_master_carton: parseInt(formData.packs_per_master_carton) || null,
      gst_percentage: parseInt(formData.gst_percentage) || 0,
      uom: formData.uom || "Kg",
      settlement_unit: formData.settlement_unit || "KG",
      base_price: parseFloat(formData.wholesale_price) || null,
      price_b2b: parseFloat(formData.wholesale_price) || null,
      private_label_moq: parseInt(formData.private_label_moq) || null,
      private_label_price: parseFloat(formData.private_label_price) || null,
      nutrition_facts: formData.nutrition_facts || null,
      allergen_warnings: formData.allergen_warnings || null,
      ingredients: formData.ingredients || null,
      product_family: formData.product_family || null,
      dimensions: formData.dimensions || null,
      material: formData.material || null,
      gross_weight_kg: parseFloat(formData.gross_weight_kg) || null,
      bom_summary: formData.bom_summary || null,
      aliases: typeof formData.aliases === "string" && formData.aliases.trim()
        ? formData.aliases.split(",").map((s: string) => s.trim()).filter(Boolean)
        : [],
      grams_per_piece: parseFloat(formData.grams_per_piece) || null,
      weight_per_box_kg: parseFloat(formData.weight_per_box_kg) || null,
    };

    try {
      let productId = editingProduct?.id;

      if (editingProduct) {
        const { error } = await (supabase as any).from("products").update(payload).eq("id", editingProduct.id);
        if (error) throw error;
      } else {
        const { data: newProd, error } = await (supabase as any).from("products").insert([payload]).select("id").single();
        if (error) throw error;
        productId = newProd.id;
      }

      // Save BOM if applicable
      if (productId && formData.has_bom) {
        // Delete existing BOM
        await supabase.from("product_bom").delete().eq("product_id", productId);
        // Insert new components
        if (bomComponents.length > 0) {
          const bomRows = bomComponents
            .filter((c) => c.component_name.trim())
            .map((c) => ({
              product_id: productId!,
              component_product_id: c.component_product_id || null,
              component_name: c.component_name,
              quantity_per_unit: c.quantity_per_unit,
              source_department: c.source_department || null,
            }));
          if (bomRows.length > 0) {
            await supabase.from("product_bom").insert(bomRows);
          }
        }
      } else if (productId && !formData.has_bom) {
        // Clear BOM if toggled off
        await supabase.from("product_bom").delete().eq("product_id", productId);
      }

      // Save Variants
      if (productId) {
        await (supabase as any).from("product_variants").delete().eq("product_id", productId);
        if (formData.enable_variants && productVariants.length > 0) {
          const variantRows = productVariants
            .filter((v: ProductVariant) => v.variant_name.trim())
            .map((v: ProductVariant) => ({
              product_id: productId!,
              variant_name: v.variant_name,
              price: v.price || 0,
              moq: v.moq || 1,
              sku: v.sku || null,
              is_active: v.is_active ?? true,
            }));
          if (variantRows.length > 0) {
            await (supabase as any).from("product_variants").insert(variantRows);
          }
        }
      }

      await supabase.auth.getSession();
      await fetchProducts();
      toast.success(editingProduct ? "Product updated successfully" : "New product added to catalog!");
      closePanel();
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

  // CORRECTED: EXACT ECONOMICS ENGINE (Pc vs Kg)
  const calculateEconomics = () => {
    const uom = formData.uom || "Kg";
    const wtPc = Number(formData.weight_per_pc_grams) || 0;
    const wtPack = Number(formData.net_weight_grams) || 0;

    let mrpPerUom = Number(formData.mrp) || 0;
    let mrpPerPc = Number(formData.mrp_per_pc) || 0;
    const b2bPerUom = Number(formData.wholesale_price) || 0;

    let b2bPerPc = 0;

    if (wtPc > 0) {
      if (uom === "Kg") {
        if (mrpPerPc > 0 && mrpPerUom === 0) mrpPerUom = (mrpPerPc / wtPc) * 1000;
        if (mrpPerUom > 0 && mrpPerPc === 0) mrpPerPc = (mrpPerUom / 1000) * wtPc;
        b2bPerPc = (b2bPerUom / 1000) * wtPc;
      } else if (uom === "Pack" || uom === "Box") {
        const pcsPerPack = wtPack > 0 ? wtPack / wtPc : 1;
        if (mrpPerPc > 0 && mrpPerUom === 0) mrpPerUom = mrpPerPc * pcsPerPack;
        if (mrpPerUom > 0 && mrpPerPc === 0) mrpPerPc = mrpPerUom / pcsPerPack;
        b2bPerPc = b2bPerUom / pcsPerPack;
      } else if (uom === "Piece") {
        mrpPerPc = mrpPerUom;
        b2bPerPc = b2bPerUom;
      }
    }

    return {
      uom,
      mrpPerUom: mrpPerUom > 0 ? mrpPerUom.toFixed(2) : "—",
      bulkPerUom: mrpPerUom > 0 ? (mrpPerUom * 0.8).toFixed(2) : "—",
      wholesalePerUom: mrpPerUom > 0 ? (mrpPerUom * 0.7).toFixed(2) : "—",
      b2bPerUom: b2bPerUom > 0 ? b2bPerUom.toFixed(2) : "0.00",
      mrpPerPc: mrpPerPc > 0 ? mrpPerPc.toFixed(2) : "—",
      bulkPerPc: mrpPerPc > 0 ? (mrpPerPc * 0.8).toFixed(2) : "—",
      wholesalePerPc: mrpPerPc > 0 ? (mrpPerPc * 0.7).toFixed(2) : "—",
      b2bPerPc: b2bPerPc > 0 ? b2bPerPc.toFixed(3) : "—",
    };
  };

  const eco = calculateEconomics();

  const normalizedCategory = (formData.category || "").trim().toLowerCase();
  const isBomCategory = normalizedCategory === "gifts & hampers" || normalizedCategory === "premium gift packs" || normalizedCategory === "premium packs";

  if (loading)
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 size={28} className="animate-spin text-[#C5A059]" />
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
            className="flex items-center gap-2 bg-[#C5A059] text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#B38F48] transition-colors shadow-sm active:scale-[0.97]"
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
              <kpi.icon size={20} className="text-[#C5A059]" />
              <div>
                <p className="text-xl font-bold text-foreground tabular-nums">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filter by Tag */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-3">
            <Filter size={16} className="text-muted-foreground" />
            <select
              value={filterTag}
              onChange={e => setFilterTag(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#C5A059]"
            >
              <option value="">All Products</option>
              {allTags.map(tag => (
                <option key={tag.id} value={tag.id}>{tag.tag_label}</option>
              ))}
            </select>
            {filterTag && (
              <span className="text-xs text-muted-foreground">{taggedProductIds.length} product(s)</span>
            )}
          </div>
        )}

        {/* Product Grid */}
        {(filterTag ? products.filter(p => taggedProductIds.includes(p.id)) : products).length === 0 ? (
          <div className="text-center py-20">
            <Package size={40} className="mx-auto text-muted-foreground/40" />
            <p className="text-lg font-semibold text-foreground mt-4">No products found</p>
            <p className="text-sm text-muted-foreground mt-1">{filterTag ? "No products with this tag." : "Your catalog is currently empty."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {(filterTag ? products.filter(p => taggedProductIds.includes(p.id)) : products).map((product, i) => (
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
                  {product.production_department && (
                    <span className="absolute top-2 left-2 bg-primary/90 text-primary-foreground text-[9px] font-bold px-2 py-0.5 rounded">
                      {product.production_department}
                    </span>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-semibold text-foreground text-sm leading-snug truncate">{product.name}</h3>
                    {product.wholesale_price && (
                      <p className="text-[#C5A059] font-bold text-sm tabular-nums shrink-0">
                        ₹{product.wholesale_price}
                      </p>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground font-mono">SKU: {product.sku || "N/A"}</p>
                    <p className="text-xs text-muted-foreground">Carton: {product.carton_type || "N/A"}</p>
                    <p className="text-xs text-muted-foreground">MOQ: {product.moq || 1} packs • {product.settlement_unit || "KG"}</p>
                  </div>
                  <div className="flex items-center gap-1.5 pt-2 border-t border-border/50">
                    <button
                      onClick={() => toggleActiveStatus(product)}
                      className={`flex-1 text-[10px] font-semibold py-1.5 rounded-md flex items-center justify-center gap-1 transition-colors ${product.is_active ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20" : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"}`}
                    >
                      {product.is_active ? <PowerOff size={10} /> : <Power size={10} />}
                      {product.is_active ? "Hide" : "Show"}
                    </button>
                    <button
                      onClick={() => openTagModal(product)}
                      className="flex-1 text-[10px] font-semibold bg-[#C5A059]/10 text-[#C5A059] hover:bg-[#C5A059]/20 py-1.5 rounded-md flex items-center justify-center gap-1 transition-colors"
                    >
                      <Tag size={10} /> Tags
                    </button>
                    <button
                      onClick={() => openPanel(product)}
                      className="flex-1 text-[10px] font-semibold bg-muted hover:bg-muted/80 text-foreground py-1.5 rounded-md flex items-center justify-center gap-1 transition-colors"
                    >
                      <Edit2 size={10} /> Edit
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
                  <Package className="text-[#C5A059]" size={20} /> {editingProduct ? "Edit Product" : "Build Product"}
                </h2>
                <button onClick={closePanel} className="p-1.5 rounded-md hover:bg-muted transition-colors">
                  <X size={18} className="text-muted-foreground" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* 1. IDENTITY & VISUALS + DEPARTMENTAL LOCK */}
                <section className="space-y-4">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-2 flex items-center gap-2">
                    <ImageIcon size={14} className="text-[#C5A059]" /> 1. Identity & Department Lock
                  </h3>

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
                        {uploadingImage ? (
                          <Loader2 size={14} className="animate-spin text-[#C5A059]" />
                        ) : (
                          <UploadCloud size={14} className="text-[#C5A059]" />
                        )}{" "}
                        {uploadingImage ? "Uploading..." : "Upload Image"}
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
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#C5A059]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex justify-between">
                        SKU Code <span className="text-[#C5A059]">Auto</span>
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
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#C5A059]"
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
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#C5A059]"
                      />
                    </div>

                    {/* PILLAR 1: TARGET DEPARTMENT (Mandatory) */}
                    <div>
                      <label className="block text-[10px] font-bold text-destructive uppercase tracking-wide mb-1.5 flex items-center gap-1">
                        Target Department * <Info size={10} />
                      </label>
                      <select
                        name="production_department"
                        value={formData.production_department}
                        onChange={handleInputChange}
                        className="w-full bg-destructive/5 border border-destructive/30 rounded-lg p-2.5 text-sm font-semibold outline-none focus:ring-1 focus:ring-destructive"
                      >
                        <option value="">— MUST SELECT —</option>
                        {TARGET_DEPARTMENTS.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                      <p className="text-[9px] text-muted-foreground mt-1">Routes orders to the correct Factory TV & RGS queue.</p>
                    </div>

                    <div className="col-span-2">
                      <div className="flex justify-between items-end mb-1.5">
                        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                          Description
                        </label>
                        <button
                          onClick={handleAiDescription}
                          disabled={isAiLoading === "desc"}
                          className="text-[10px] font-bold text-[#C5A059] hover:underline flex items-center gap-1"
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
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#C5A059] resize-none"
                      />
                    </div>

                    {/* NOT FOR SALE TOGGLE */}
                    <div className="col-span-2 flex items-center gap-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      <input
                        type="checkbox"
                        id="bom_only"
                        checked={!formData.visible_in_catalog}
                        onChange={(e) => setFormData((prev: any) => ({ ...prev, visible_in_catalog: !e.target.checked }))}
                        className="w-4 h-4 rounded border-border text-amber-600 focus:ring-amber-500"
                      />
                      <label htmlFor="bom_only" className="text-xs font-semibold text-foreground cursor-pointer">
                        Product is for Internal BOM Use Only (Hide from Storefront)
                      </label>
                      <span className="text-[9px] text-muted-foreground ml-auto">
                        {formData.visible_in_catalog ? "Visible to buyers" : "Hidden — internal only"}
                      </span>
                    </div>
                  </div>
                </section>

                {/* SECTION 3: OPERATIONS & BOM BREAKDOWN (conditional) */}
                {isBomCategory && (
                  <section className="space-y-4">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-2 flex items-center gap-2">
                      <Layers size={14} className="text-purple-500" /> 3. Operations & BOM Breakdown
                    </h3>
                    <p className="text-[10px] text-muted-foreground">
                      Define the components that make up this {formData.category}. Each component will be routed to its source department by the Diverter.
                      Settlement: <span className="font-bold text-foreground">{formData.settlement_unit === "PCS" ? "Count (PCS)" : "Weight (KG)"}</span> — BOM quantities should match.
                    </p>
                    <div className="flex items-center gap-3 mb-2">
                      <label className="text-xs font-semibold text-foreground">Enable BOM Blast</label>
                      <button
                        type="button"
                        onClick={() => setFormData((prev: any) => ({ ...prev, has_bom: !prev.has_bom }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.has_bom ? "bg-purple-500" : "bg-muted"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${formData.has_bom ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                      <span className="text-[9px] text-muted-foreground">When ordered, components route to their departments</span>
                    </div>

                    {formData.has_bom && (
                      <div className="space-y-3">
                        {bomComponents.map((comp, idx) => (
                          <div key={idx} className="bg-muted/20 p-3 rounded-lg border border-border space-y-2">
                            <div className="grid grid-cols-12 gap-2 items-end">
                              <div className="col-span-4 relative">
                                <label className="block text-[9px] font-semibold text-muted-foreground uppercase mb-1">
                                  <Search size={9} className="inline mr-1" />Search Product / SKU
                                </label>
                                <input
                                  value={bomSearchingIdx === idx ? bomSearchQuery : comp.component_name}
                                  onChange={(e) => {
                                    updateBomComponent(idx, "component_name", e.target.value);
                                    searchProductsForBom(e.target.value, idx);
                                  }}
                                  onFocus={() => {
                                    setBomSearchingIdx(idx);
                                    setBomSearchQuery(comp.component_name);
                                  }}
                                  placeholder="e.g. Pistachio Baklawa"
                                  className="w-full bg-background border border-border rounded-md p-2 text-xs outline-none focus:ring-1 focus:ring-purple-500"
                                />
                                {bomSearchingIdx === idx && bomSearchResults.length > 0 && (
                                  <div className="absolute z-20 top-full left-0 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                    {bomSearchResults.map((p) => (
                                      <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => selectBomProduct(idx, p)}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex justify-between items-center"
                                      >
                                        <span className="font-medium text-foreground truncate">{p.name}</span>
                                        <span className="text-[9px] text-muted-foreground ml-2 shrink-0">
                                          ₹{(p as any).wholesale_price || 0} • {(p as any).production_department || "No Dept"}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="col-span-2">
                                <label className="block text-[9px] font-semibold text-muted-foreground uppercase mb-1">Qty Value</label>
                                <input
                                  type="number"
                                  step={comp.uom === "Gms" ? "0.001" : "1"}
                                  value={comp.quantity_per_unit}
                                  onChange={(e) => updateBomComponent(idx, "quantity_per_unit", parseFloat(e.target.value) || 0)}
                                  placeholder={comp.uom === "Gms" ? "500" : "1"}
                                  className="w-full bg-background border border-border rounded-md p-2 text-xs outline-none focus:ring-1 focus:ring-purple-500"
                                />
                              </div>
                              <div className="col-span-1">
                                <label className="block text-[9px] font-semibold text-muted-foreground uppercase mb-1">UOM</label>
                                <select
                                  value={comp.uom}
                                  onChange={(e) => updateBomComponent(idx, "uom", e.target.value)}
                                  className="w-full bg-background border border-border rounded-md p-2 text-xs outline-none focus:ring-1 focus:ring-purple-500"
                                >
                                  <option value="Gms">Gms</option>
                                  <option value="Pcs">Pcs</option>
                                </select>
                              </div>
                              <div className="col-span-4">
                                <label className="block text-[9px] font-semibold text-muted-foreground uppercase mb-1">
                                  Source Dept {comp.component_product_id && <span className="text-green-600">(Auto)</span>}
                                </label>
                                <select
                                  value={comp.source_department}
                                  onChange={(e) => updateBomComponent(idx, "source_department", e.target.value)}
                                  className={`w-full border rounded-md p-2 text-xs outline-none focus:ring-1 focus:ring-purple-500 ${comp.component_product_id ? "bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800 font-semibold" : "bg-background border-border"}`}
                                >
                                  <option value="">—</option>
                                  {TARGET_DEPARTMENTS.map((d) => (
                                    <option key={d} value={d}>{d}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-span-1 flex justify-center">
                                <button
                                  type="button"
                                  onClick={() => removeBomComponent(idx)}
                                  className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            {comp.component_product_id && (
                              <p className="text-[9px] text-green-600 flex items-center gap-1">
                                ✓ Linked — Cost: ₹{comp.unit_cost || 0}/{comp.uom} • Source Dept auto-fetched
                              </p>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addBomComponent}
                          className="flex items-center gap-2 text-xs font-bold text-purple-500 hover:text-purple-600 py-2"
                        >
                          <Plus size={14} /> Add Component
                        </button>
                        {bomComponents.length > 0 && (
                          <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 text-[10px] text-muted-foreground space-y-1">
                            <div><strong className="text-foreground">{bomComponents.length} component(s)</strong> defined.
                            Departments: {[...new Set(bomComponents.map(c => c.source_department).filter(Boolean))].join(", ") || "None assigned"}</div>
                            {(() => {
                              const bomTotal = bomComponents.reduce((sum, c) => {
                                if (!c.unit_cost) return sum;
                                const qty = c.uom === "Gms" ? c.quantity_per_unit / 1000 : c.quantity_per_unit;
                                return sum + qty * c.unit_cost;
                              }, 0);
                              return bomTotal > 0 ? (
                                <div className="text-xs font-bold text-foreground">
                                  Estimated BOM Cost: ₹{bomTotal.toFixed(2)} / unit
                                  {Number(formData.wholesale_price) > 0 && (
                                    <span className={`ml-2 ${bomTotal > Number(formData.wholesale_price) ? "text-destructive" : "text-green-600"}`}>
                                      ({bomTotal > Number(formData.wholesale_price) ? "⚠ Exceeds" : "✓ Under"} B2B Base ₹{formData.wholesale_price})
                                    </span>
                                  )}
                                </div>
                              ) : null;
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                )}

                {/* 2. COMMERCIALS & LOGISTICS + PILLAR 3: SETTLEMENT UNIT */}
                <section className="space-y-4">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-2 flex items-center gap-2">
                    <Calculator size={14} className="text-[#C5A059]" /> 2. Commercials & Logistics
                  </h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                        Unit of Measure (UOM)
                      </label>
                      <select
                        name="uom"
                        value={formData.uom}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#C5A059]"
                      >
                        <option value="Kg">Kg</option>
                        <option value="Pack">Pack</option>
                        <option value="Piece">Piece</option>
                        <option value="Box">Box</option>
                      </select>
                    </div>

                    {/* PILLAR 3: SETTLEMENT UNIT */}
                    <div>
                      <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1.5 flex items-center gap-1">
                        Settlement Unit <Info size={10} />
                      </label>
                      <select
                        name="settlement_unit"
                        value={formData.settlement_unit}
                        onChange={handleInputChange}
                        className="w-full bg-blue-50 dark:bg-blue-950/20 border border-blue-300 dark:border-blue-800 rounded-lg p-2.5 text-sm font-semibold outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="KG">Weight (KG)</option>
                        <option value="PCS">Count (PCS)</option>
                      </select>
                      <p className="text-[9px] text-muted-foreground mt-1">
                        {formData.settlement_unit === "PCS" ? "Dispatch & Finance use unit counting." : "Dispatch & Finance use decimal weight."}
                      </p>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-[#C5A059] uppercase mb-1.5 flex items-center gap-1">
                        MOQ (No. of Packs) <Info size={12} />
                      </label>
                      <input
                        type="number"
                        name="moq"
                        value={formData.moq}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-[#C5A059]/50 text-foreground rounded-lg p-2.5 font-bold outline-none focus:ring-1 focus:ring-[#C5A059]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                        Printed MRP (₹) / {formData.uom}
                      </label>
                      <input
                        type="number"
                        name="mrp"
                        value={formData.mrp}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#C5A059] font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                        MRP / Piece (₹)
                      </label>
                      <input
                        type="number"
                        name="mrp_per_pc"
                        value={formData.mrp_per_pc}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#C5A059]"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-[#C5A059] uppercase mb-1.5">
                        B2B Base (₹) / {formData.uom} *
                      </label>
                      <input
                        type="number"
                        name="wholesale_price"
                        value={formData.wholesale_price}
                        onChange={handleInputChange}
                        className="w-full bg-[#C5A059]/10 border border-[#C5A059]/30 text-foreground rounded-lg p-2.5 font-bold outline-none focus:ring-1 focus:ring-[#C5A059]"
                      />
                    </div>

                    {/* Product Family selector — drives which fields appear below */}
                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                        Product Family *
                      </label>
                      <select
                        name="product_family"
                        value={formData.product_family}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#C5A059]"
                      >
                        <option value="bulk_sweets">Bulk Sweets (sold by weight)</option>
                        <option value="retail_pack">Retail Pack</option>
                        <option value="goldware">Goldware / Packaging</option>
                        <option value="hampers">Hamper / Gift Pack</option>
                      </select>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Determines which catalogue fields are shown and how the item is displayed to buyers.
                      </p>
                    </div>

                    {/* BULK SWEETS / RETAIL — weight fields */}
                    {(formData.product_family === "bulk_sweets" || formData.product_family === "retail_pack" || !formData.product_family) && (
                      <>
                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                            Avg Wt / Pack (g)
                          </label>
                          <input
                            type="number"
                            name="net_weight_grams"
                            value={formData.net_weight_grams}
                            onChange={handleInputChange}
                            className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#C5A059]"
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
                            className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#C5A059]"
                          />
                        </div>
                      </>
                    )}

                    {/* GOLDWARE — dimensions + material (weight hidden) */}
                    {formData.product_family === "goldware" && (
                      <>
                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                            Dimensions / Size
                          </label>
                          <input
                            type="text"
                            name="dimensions"
                            placeholder='e.g. "12-inch" or "10 x 8 in"'
                            value={formData.dimensions}
                            onChange={handleInputChange}
                            className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#C5A059]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                            Material
                          </label>
                          <input
                            type="text"
                            name="material"
                            placeholder="e.g. Brass, Acrylic, Wood"
                            value={formData.material}
                            onChange={handleInputChange}
                            className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#C5A059]"
                          />
                        </div>
                      </>
                    )}

                    {/* HAMPERS — BOM summary + gross weight */}
                    {formData.product_family === "hampers" && (
                      <>
                        <div className="col-span-2">
                          <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                            BOM / Included Items
                          </label>
                          <textarea
                            name="bom_summary"
                            placeholder="e.g. 2x Asabi 250g, 1x Pyramid 500g, 1x Brass Tray 10in"
                            value={formData.bom_summary}
                            onChange={handleInputChange}
                            rows={2}
                            className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#C5A059]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                            Gross Weight (kg)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            name="gross_weight_kg"
                            value={formData.gross_weight_kg}
                            onChange={handleInputChange}
                            className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#C5A059]"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                        Packs / Carton
                      </label>
                      <input
                        type="number"
                        name="packs_per_master_carton"
                        value={formData.packs_per_master_carton}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#C5A059]"
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

                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                        HSN Code
                      </label>
                      <input
                        name="hsn_code"
                        value={formData.hsn_code}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#C5A059]"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                        GST Rate (%)
                      </label>
                      <select
                        name="gst_percentage"
                        value={formData.gst_percentage}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#C5A059]"
                      >
                        {GST_RATES.map((rate) => (
                          <option key={rate} value={rate}>
                            {rate}%
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Dynamic Unit Economics Summary */}
                  {(Number(formData.mrp) > 0 || Number(formData.mrp_per_pc) > 0) && (
                    <div className="bg-[#C5A059]/5 border border-[#C5A059]/20 rounded-xl p-5 mt-4">
                      <p className="text-[10px] font-bold text-[#C5A059] uppercase tracking-widest mb-4 flex items-center gap-1">
                        <Calculator size={12} /> Live Unit Economics (Piece vs {eco.uom})
                      </p>
                      <div className="grid grid-cols-4 gap-3 border-b border-[#C5A059]/20 pb-3 mb-3">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">MRP / {eco.uom}</p>
                          <p className="text-sm font-bold text-foreground">₹{eco.mrpPerUom}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Bulk (-20%) / {eco.uom}</p>
                          <p className="text-sm font-bold text-foreground">₹{eco.bulkPerUom}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Wholesale (-30%) / {eco.uom}</p>
                          <p className="text-sm font-bold text-foreground">₹{eco.wholesalePerUom}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-[#C5A059] font-bold uppercase">B2B Base / {eco.uom}</p>
                          <p className="text-sm font-bold text-[#C5A059]">₹{eco.b2bPerUom}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">MRP / Piece</p>
                          <p className="text-sm font-bold text-foreground">₹{eco.mrpPerPc}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Bulk / Piece</p>
                          <p className="text-sm font-bold text-foreground">₹{eco.bulkPerPc}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Wholesale / Piece</p>
                          <p className="text-sm font-bold text-foreground">₹{eco.wholesalePerPc}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-[#C5A059] font-bold uppercase">B2B Cost / Piece</p>
                          <p className="text-sm font-bold text-[#C5A059]">₹{eco.b2bPerPc}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                {/* 3. CONDITIONAL: PRIVATE LABEL */}
                {formData.category === "Ready packs" && (
                  <section className="space-y-4">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-2 flex items-center gap-2">
                      <Package size={14} className="text-[#C5A059]" /> 3. Private Label Config
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
                          className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#C5A059]"
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
                          className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#C5A059]"
                        />
                      </div>
                    </div>
                  </section>
                )}

                {/* 4. FOOD COMPLIANCE + PILLAR 4: AI ATTRIBUTE GENERATOR */}
                <section className="space-y-4">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-2 flex items-center gap-2">
                    <Leaf size={14} className="text-green-600" /> 4. Food Compliance & AI Attributes
                  </h3>

                  {/* AI Generate All Button */}
                  <button
                    type="button"
                    onClick={handleAiFullGenerate}
                    disabled={isAiLoading === "full" || !formData.name}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all shadow-md disabled:opacity-50 active:scale-[0.98]"
                  >
                    {isAiLoading === "full" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Zap size={16} />
                    )}
                    {isAiLoading === "full" ? "Generating AI Attributes..." : "⚡ Generate AI Details (Nutrition, Allergens, HSN, GST)"}
                  </button>

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
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors border ${formData.dietary_tags.includes(tag) ? "bg-[#C5A059] text-white border-[#C5A059]" : "bg-card text-muted-foreground border-border hover:bg-muted"}`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Allergen Warnings */}
                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-destructive uppercase mb-1.5 flex items-center gap-1">
                        ⚠️ Allergen Warnings
                      </label>
                      <input
                        name="allergen_warnings"
                        value={formData.allergen_warnings}
                        onChange={handleInputChange}
                        placeholder="e.g. Contains: Tree Nuts, Milk/Dairy, Wheat/Gluten"
                        className="w-full bg-destructive/5 border border-destructive/20 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-destructive"
                      />
                    </div>

                    {/* Ingredients */}
                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                        Ingredients List
                      </label>
                      <textarea
                        name="ingredients"
                        rows={2}
                        value={formData.ingredients}
                        onChange={handleInputChange}
                        placeholder="Ingredients in descending order..."
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-[#C5A059] resize-none"
                      />
                    </div>

                    {/* Nutrition Panel */}
                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                        FSSAI Nutrition Panel
                      </label>
                      <textarea
                        name="nutrition_facts"
                        rows={5}
                        value={formData.nutrition_facts}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border rounded-lg p-2.5 text-xs font-mono outline-none focus:ring-1 focus:ring-green-600 resize-none"
                        placeholder="Nutrition details per 100g..."
                      />
                    </div>
                  </div>
                </section>

                {/* 5. PRODUCT VARIANTS */}
                <section className="space-y-4">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-2 flex items-center gap-2">
                    <Layers size={14} className="text-blue-500" /> 5. Product Variants
                  </h3>
                  <div className="flex items-center gap-3 mb-2">
                    <label className="text-xs font-semibold text-foreground">Enable Variants</label>
                    <button
                      type="button"
                      onClick={() => setFormData((prev: any) => ({ ...prev, enable_variants: !prev.enable_variants }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.enable_variants ? "bg-blue-500" : "bg-muted"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${formData.enable_variants ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                    <span className="text-[9px] text-muted-foreground">Define size/weight variants with individual pricing & MOQ</span>
                  </div>
                  {formData.enable_variants && (
                    <VariantManager variants={productVariants} onChange={setProductVariants} />
                  )}
                </section>

                {/* Active Toggle */}
                <div className="flex items-center gap-3 bg-muted/20 p-4 rounded-xl border border-border mt-4">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-border text-[#C5A059] focus:ring-[#C5A059]"
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
                  className="px-6 py-2.5 rounded-lg font-bold text-sm bg-[#C5A059] text-white hover:bg-[#B38F48] transition-colors shadow-sm flex items-center gap-2 active:scale-[0.97] disabled:opacity-50"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}{" "}
                  {editingProduct ? "Save Changes" : "Publish Product"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Tag Management Modal */}
      <AnimatePresence>
        {tagModalProduct && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setTagModalProduct(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Tag size={18} className="text-[#C5A059]" /> Manage Tags
                </h3>
                <button onClick={() => setTagModalProduct(null)} className="p-1 hover:bg-muted rounded-md">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Assigning tags to: <span className="font-semibold text-foreground">{tagModalProduct.name}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTagSelection(tag.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                      selectedTagIds.includes(tag.id)
                        ? "bg-[#C5A059] text-white border-[#C5A059]"
                        : "bg-background text-muted-foreground border-border hover:border-[#C5A059]/50"
                    }`}
                  >
                    {tag.tag_label}
                  </button>
                ))}
                {allTags.length === 0 && (
                  <p className="text-xs text-muted-foreground">No tags found. Create tags in Product Tags settings.</p>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setTagModalProduct(null)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg">
                  Cancel
                </button>
                <button
                  onClick={saveTagMappings}
                  disabled={savingTags}
                  className="px-5 py-2 rounded-lg font-bold text-sm bg-[#C5A059] text-white hover:bg-[#B38F48] transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {savingTags && <Loader2 size={14} className="animate-spin" />} Save Tags
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
