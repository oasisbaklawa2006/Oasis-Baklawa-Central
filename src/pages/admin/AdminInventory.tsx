import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, PackageOpen, AlertTriangle, Plus, ArrowDownToLine, Search, Box } from "lucide-react";
import TopNavBar from "@/components/TopNavBar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  current_stock: number;
  min_threshold: number;
  unit: string;
  last_restocked: string;
}

const CATEGORIES = ["Raw Material", "Packaging", "Consumables", "Finished Goods"];
const UNITS = ["kg", "grams", "liters", "pcs", "boxes", "rolls"];

const AdminInventory = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Raw Material");
  const [newItemUnit, setNewItemUnit] = useState("kg");
  const [newItemThreshold, setNewItemThreshold] = useState(10);

  const [addQty, setAddQty] = useState<number | string>("");

  const fetchInventory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .order("name", { ascending: true });
    if (!error && data) setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleCreateItem = async () => {
    if (!newItemName.trim()) {
      toast.error("Item name is required.");
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.from("inventory_items").insert({
      name: newItemName,
      category: newItemCategory,
      unit: newItemUnit,
      min_threshold: newItemThreshold,
      current_stock: 0,
    });
    if (!error) {
      toast.success("SKU added to catalog!");
      setIsAddModalOpen(false);
      setNewItemName("");
      fetchInventory();
    }
    setIsSubmitting(false);
  };

  const handleRestock = async () => {
    if (!restockItem || !addQty || Number(addQty) <= 0) return;
    setIsSubmitting(true);
    const newStock = Number(restockItem.current_stock) + Number(addQty);
    const { error } = await supabase
      .from("inventory_items")
      .update({
        current_stock: newStock,
        last_restocked: new Date().toISOString(),
      })
      .eq("id", restockItem.id);

    if (!error) {
      await supabase
        .from("stock_logs")
        .insert({ item_id: restockItem.id, quantity_added: Number(addQty) });
      toast.success("Stock Updated!");
      setRestockItem(null);
      setAddQty("");
      fetchInventory();
    }
    setIsSubmitting(false);
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavBar />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <PackageOpen className="h-7 w-7 text-primary" />
              <h1 className="text-2xl font-black text-foreground tracking-tight">
                Warehouse Inventory
              </h1>
            </div>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-6 py-3 rounded-xl bg-foreground text-background font-black text-sm uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Add SKU
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const isLow = item.current_stock <= item.min_threshold;
            return (
              <div
                key={item.id}
                className={`rounded-2xl border p-5 shadow-sm transition-all ${
                  isLow
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-border bg-card"
                }`}
              >
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {item.category}
                  </span>
                  <h3 className="text-lg font-black text-foreground mt-1">
                    {item.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mt-2">
                    {isLow && (
                      <AlertTriangle className="h-4 w-4 text-destructive mr-1" />
                    )}
                    <span
                      className={`text-3xl font-black ${
                        isLow ? "text-destructive" : "text-foreground"
                      }`}
                    >
                      {item.current_stock}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {item.unit}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setRestockItem(item)}
                  className="mt-6 w-full py-2.5 rounded-xl border border-border text-foreground font-bold text-xs hover:bg-muted transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowDownToLine className="h-4 w-4" /> Restock
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ADD SKU MODAL */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add New SKU</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Item Name</Label>
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="rounded-xl bg-muted/50"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={newItemCategory} onValueChange={setNewItemCategory}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Unit</Label>
                <Select value={newItemUnit} onValueChange={setNewItemUnit}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Min Alert</Label>
                <Input
                  type="number"
                  value={newItemThreshold}
                  onChange={(e) => setNewItemThreshold(Number(e.target.value))}
                  className="rounded-xl"
                />
              </div>
            </div>
            <button
              onClick={handleCreateItem}
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-foreground text-background font-black text-sm uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              ) : (
                "Create SKU"
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* RESTOCK MODAL */}
      <Dialog
        open={!!restockItem}
        onOpenChange={(open) => {
          if (!open) setRestockItem(null);
        }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Update Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Item: <span className="font-bold text-foreground">{restockItem?.name}</span>
            </p>
            <div>
              <Label>Qty Received ({restockItem?.unit})</Label>
              <Input
                type="number"
                value={addQty}
                onChange={(e) => setAddQty(Number(e.target.value))}
                className="rounded-xl bg-muted/50 font-black text-xl h-14"
                autoFocus
              />
            </div>
            <button
              onClick={handleRestock}
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-foreground text-background font-black text-sm uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              ) : (
                "Confirm Stock Addition"
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInventory;
