import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Loader2, GripVertical, Tag, Sparkles } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ProductTag {
  id: string;
  tag_key: string;
  tag_label: string;
  is_active: boolean;
}

interface MappedProduct {
  mapping_id: string;
  product_id: string;
  name: string;
  image_url: string | null;
  manual_sort_index: number | null;
}

function SortableItem({ item }: { item: MappedProduct }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.mapping_id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-4 bg-card border border-border rounded-xl p-4 shadow-sm ${isDragging ? "ring-2 ring-primary" : ""}`}>
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-primary transition-colors">
        <GripVertical size={18} />
      </button>
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted/30 shrink-0">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg">🍯</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground truncate">{item.name}</p>
        <p className="text-[10px] text-muted-foreground font-mono">Sort: {item.manual_sort_index ?? "—"}</p>
      </div>
    </div>
  );
}

const AdminMerchandising = () => {
  const [tags, setTags] = useState<ProductTag[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [items, setItems] = useState<MappedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const loadTags = async () => {
      const { data } = await supabase.from("product_tags").select("*").eq("is_active", true).order("sort_order");
      setTags(data || []);
      setLoading(false);
    };
    loadTags();
  }, []);

  const loadMappedProducts = useCallback(async (tagId: string) => {
    setLoadingItems(true);
    setSelectedTag(tagId);

    const { data: mappings } = await supabase
      .from("product_tag_mapping")
      .select("id, product_id, manual_sort_index")
      .eq("tag_id", tagId)
      .order("manual_sort_index", { ascending: true, nullsFirst: false });

    if (!mappings || mappings.length === 0) {
      setItems([]);
      setLoadingItems(false);
      return;
    }

    const productIds = mappings.map(m => m.product_id).filter(Boolean) as string[];
    const { data: prods } = await supabase
      .from("products")
      .select("id, name, image_url")
      .in("id", productIds);

    const prodMap: Record<string, any> = {};
    (prods || []).forEach(p => { prodMap[p.id] = p; });

    const mapped: MappedProduct[] = mappings
      .filter(m => m.product_id && prodMap[m.product_id])
      .map(m => ({
        mapping_id: m.id,
        product_id: m.product_id!,
        name: prodMap[m.product_id!].name,
        image_url: prodMap[m.product_id!].image_url,
        manual_sort_index: m.manual_sort_index,
      }));

    setItems(mapped);
    setLoadingItems(false);
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems(prev => {
      const oldIndex = prev.findIndex(i => i.mapping_id === active.id);
      const newIndex = prev.findIndex(i => i.mapping_id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleSaveOrder = async () => {
    setSaving(true);
    const updates = items.map((item, idx) => 
      supabase.from("product_tag_mapping").update({ manual_sort_index: idx + 1 }).eq("id", item.mapping_id)
    );
    await Promise.all(updates);
    setItems(prev => prev.map((item, idx) => ({ ...item, manual_sort_index: idx + 1 })));
    toast.success("Sort order saved!");
    setSaving(false);
  };

  if (loading) return (
    <div className="flex justify-center py-32">
      <Loader2 size={28} className="animate-spin text-primary" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-3">
          <Sparkles className="text-[#C5A059]" size={24} /> Merchandising Controller
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Drag-and-drop to reorder products within each tag section.</p>
      </div>

      {/* Tag selector */}
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <button
            key={tag.id}
            onClick={() => loadMappedProducts(tag.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
              selectedTag === tag.id
                ? "bg-[#C5A059] text-white border-[#C5A059] shadow-md"
                : "bg-card text-muted-foreground border-border hover:border-[#C5A059]/50"
            }`}
          >
            <Tag size={12} /> {tag.tag_label}
          </button>
        ))}
      </div>

      {/* Sortable list */}
      {selectedTag && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {loadingItems ? (
            <div className="flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Tag size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No products mapped to this tag yet.</p>
            </div>
          ) : (
            <>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map(i => i.mapping_id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {items.map(item => (
                      <SortableItem key={item.mapping_id} item={item} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleSaveOrder}
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm bg-[#C5A059] text-white hover:bg-[#B38F48] transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Save Sort Order
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default AdminMerchandising;
