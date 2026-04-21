import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, X, Check, Search, Sparkles, Loader2 } from "lucide-react";

interface ProductRow {
  id: string;
  name: string;
  aliases: string[] | null;
}

interface AliasDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Token detected as UNRECOGNIZED in a message — pre-fills the "add" field. */
  pendingToken?: string | null;
  /** Refresh callback so the parent can re-pull aliases after a save. */
  onAliasesChanged?: () => void;
}

/**
 * War Room Alias Editor — Side drawer to approve / add aliases on the fly.
 *
 * Flow:
 *   1. Search SKU → pick → see current aliases.
 *   2. Add new alias (pre-filled with `pendingToken` if provided).
 *   3. Save = (a) append to products.aliases[], (b) insert into product_aliases for parser pickup.
 *   4. AI Suggest = ask edge function for 5–10 nicknames; admin one-click approves each.
 */
export default function AliasDrawer({ open, onOpenChange, pendingToken, onAliasesChanged }: AliasDrawerProps) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ProductRow | null>(null);
  const [newAlias, setNewAlias] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, aliases")
        .eq("is_active", true)
        .order("name");
      setProducts((data as ProductRow[]) ?? []);
    })();
    setNewAlias(pendingToken || "");
    setSuggestions([]);
  }, [open, pendingToken]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 50);
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 50);
  }, [products, search]);

  const refreshSelected = async (id: string) => {
    const { data } = await supabase
      .from("products")
      .select("id, name, aliases")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      setSelected(data as ProductRow);
      setProducts((prev) => prev.map((p) => (p.id === id ? (data as ProductRow) : p)));
    }
  };

  const saveAlias = async (alias: string) => {
    if (!selected) return;
    const clean = alias.trim();
    if (!clean) return;
    setSaving(true);
    try {
      const current = selected.aliases ?? [];
      if (current.some((a) => a.toLowerCase() === clean.toLowerCase())) {
        toast.info("Alias already exists for this SKU");
        setSaving(false);
        return;
      }
      const next = [...current, clean];

      // 1) products.aliases[] — array column update
      const { error: pErr } = await supabase
        .from("products")
        .update({ aliases: next } as any)
        .eq("id", selected.id);
      if (pErr) throw pErr;

      // 2) product_aliases lookup — used by parser
      await supabase
        .from("product_aliases")
        .insert({ alias_text: clean, canonical_name: selected.name } as any);

      toast.success(`"${clean}" → ${selected.name}`);
      setNewAlias("");
      setSuggestions((s) => s.filter((x) => x.toLowerCase() !== clean.toLowerCase()));
      await refreshSelected(selected.id);
      onAliasesChanged?.();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save alias");
    }
    setSaving(false);
  };

  const removeAlias = async (alias: string) => {
    if (!selected) return;
    const next = (selected.aliases ?? []).filter((a) => a !== alias);
    const { error } = await supabase
      .from("products")
      .update({ aliases: next } as any)
      .eq("id", selected.id);
    if (error) {
      toast.error("Failed to remove");
      return;
    }
    // Best-effort: also remove from lookup
    await supabase
      .from("product_aliases")
      .delete()
      .ilike("alias_text", alias)
      .ilike("canonical_name", selected.name);
    toast.success("Alias removed");
    await refreshSelected(selected.id);
    onAliasesChanged?.();
  };

  const aiSuggest = async () => {
    if (!selected) return;
    setSuggesting(true);
    setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke("oasis-ai-chat", {
        body: {
          mode: "alias_suggest",
          product_name: selected.name,
          existing_aliases: selected.aliases ?? [],
          prompt:
            `Suggest 5-10 short B2B WhatsApp nicknames / shorthand a sweet-shop owner might type ` +
            `for the product "${selected.name}". Return ONLY a JSON array of lowercase strings, no prose.`,
        },
      });
      if (error) throw error;
      let list: string[] = [];
      const raw = (data?.reply || data?.text || data?.content || "").toString();
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        try { list = JSON.parse(match[0]); } catch { /* ignore */ }
      }
      list = list
        .map((s) => String(s).trim())
        .filter(Boolean)
        .filter((s) => !(selected.aliases ?? []).some((a) => a.toLowerCase() === s.toLowerCase()))
        .slice(0, 10);
      if (list.length === 0) toast.info("No new suggestions");
      setSuggestions(list);
    } catch (e: any) {
      toast.error("AI suggest unavailable");
    }
    setSuggesting(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>SKU Alias Editor</SheetTitle>
          <SheetDescription>
            Approve, add, or auto-learn nicknames the parser will recognize on the next message.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU…"
              className="pl-8"
            />
          </div>

          {/* Product list */}
          {!selected && (
            <div className="border rounded-md max-h-64 overflow-y-auto">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between border-b last:border-b-0"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="text-[10px] text-muted-foreground ml-2">
                    {(p.aliases ?? []).length} alias{(p.aliases ?? []).length !== 1 ? "es" : ""}
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground p-3 text-center">No products match</p>
              )}
            </div>
          )}

          {/* Selected SKU panel */}
          {selected && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{selected.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {(selected.aliases ?? []).length} active alias{(selected.aliases ?? []).length !== 1 ? "es" : ""}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setSelected(null); setSuggestions([]); }}>
                  Change
                </Button>
              </div>

              {/* Existing aliases */}
              <div className="flex flex-wrap gap-1.5">
                {(selected.aliases ?? []).map((a) => (
                  <Badge key={a} variant="secondary" className="gap-1">
                    {a}
                    <button onClick={() => removeAlias(a)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {(selected.aliases ?? []).length === 0 && (
                  <p className="text-[11px] text-muted-foreground italic">No aliases yet — add one below.</p>
                )}
              </div>

              {/* Add new */}
              <div className="flex gap-2">
                <Input
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  placeholder="e.g. kitta, mix tart"
                  onKeyDown={(e) => { if (e.key === "Enter") saveAlias(newAlias); }}
                />
                <Button onClick={() => saveAlias(newAlias)} disabled={saving || !newAlias.trim()} size="sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>

              {/* AI suggest */}
              <div>
                <Button onClick={aiSuggest} disabled={suggesting} variant="outline" size="sm" className="w-full">
                  {suggesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  AI: Suggest 5-10 nicknames
                </Button>
                {suggestions.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {suggestions.map((s) => (
                      <div key={s} className="flex items-center justify-between gap-2 text-xs px-2 py-1 rounded border">
                        <span className="truncate">{s}</span>
                        <button
                          onClick={() => saveAlias(s)}
                          className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
