import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Check, Loader2, Plus, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

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
export default function AliasDrawer({
  open,
  onOpenChange,
  pendingToken,
  onAliasesChanged,
}: AliasDrawerProps) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ProductRow | null>(null);
  const [newAlias, setNewAlias] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
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

      // 1) products.aliases[] — array column update. Generated types lag this column.
      const { error: pErr } = await supabase
        .from("products")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ aliases: next } as any)
        .eq("id", selected.id);
      if (pErr) throw pErr;

      // 2) product_aliases lookup — used by parser. Generated types lag this relation.
      await supabase
        .from("product_aliases")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert({ alias_text: clean, canonical_name: selected.name } as any);

      toast.success(`"${clean}" → ${selected.name}`);
      setNewAlias("");
      setSuggestions((s) => s.filter((x) => x.toLowerCase() !== clean.toLowerCase()));
      await refreshSelected(selected.id);
      onAliasesChanged?.();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save alias");
    }
    setSaving(false);
  };

  const removeAlias = async (alias: string) => {
    if (!selected) return;
    const next = (selected.aliases ?? []).filter((a) => a !== alias);
    const { error } = await supabase
      .from("products")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ aliases: next } as any)
      .eq("id", selected.id);
    if (error) {
      toast.error("Failed to remove");
      return;
    }
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
      const promptAliases: string[] = [];
      let promptAliasChars = 0;
      for (const alias of (selected.aliases ?? []).slice(0, 50)) {
        const separatorChars = promptAliases.length > 0 ? 2 : 0;
        const nextChars = promptAliasChars + separatorChars + alias.length;
        if (nextChars > 2000) break;
        promptAliases.push(alias);
        promptAliasChars = nextChars;
      }

      const prompt =
        `Suggest 5-10 short B2B WhatsApp nicknames / shorthand a sweet-shop owner might type ` +
        `for the product "${selected.name}". Existing aliases: ${promptAliases.join(", ") || "none"}. ` +
        `Return ONLY a JSON array of lowercase strings, no prose.`;
      const { data, error } = await supabase.functions.invoke("oasis-ai-chat", {
        body: {
          messages: [{ role: "user", content: prompt }],
        },
      });
      if (error) throw error;
      let raw = "";
      if (data instanceof Response) {
        if (!data.body) throw new Error("AI stream unavailable");
        const reader = data.body.getReader();
        const decoder = new TextDecoder();
        let pending = "";
        let done = false;
        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;
          pending += decoder.decode(value, { stream: !done });
          const records = pending.split(/\r?\n\r?\n/);
          pending = records.pop() ?? "";
          for (const record of records) {
            for (const line of record.split(/\r?\n/)) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const event = JSON.parse(payload) as {
                  choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
                };
                raw += event.choices?.[0]?.delta?.content ?? event.choices?.[0]?.message?.content ?? "";
              } catch {
                // Ignore non-JSON keepalive/event records.
              }
            }
          }
        }
        if (pending.trim()) {
          for (const line of pending.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const event = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
              };
              raw += event.choices?.[0]?.delta?.content ?? event.choices?.[0]?.message?.content ?? "";
            } catch {
              // Ignore incomplete/non-JSON trailing records.
            }
          }
        }
      } else if (typeof data === "string") {
        raw = data;
      } else if (data && typeof data === "object") {
        const responseData = data as Record<string, unknown>;
        const fallback = responseData.reply ?? responseData.text ?? responseData.content;
        raw = typeof fallback === "string" ? fallback : "";
      }

      let list: string[] = [];
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          list = JSON.parse(match[0]);
        } catch {
          // Ignore malformed provider content and fail to an empty suggestion set.
        }
      }
      list = list
        .map((value) => String(value).trim())
        .filter(Boolean)
        .filter(
          (value) =>
            !(selected.aliases ?? []).some(
              (alias) => alias.toLowerCase() === value.toLowerCase(),
            ),
        )
        .slice(0, 10);
      if (list.length === 0) toast.info("No new suggestions");
      setSuggestions(list);
    } catch {
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
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search SKU…"
              className="pl-8"
            />
          </div>

          {!selected && (
            <div className="border rounded-md max-h-64 overflow-y-auto">
              {filtered.map((product) => (
                <button
                  key={product.id}
                  onClick={() => setSelected(product)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between border-b last:border-b-0"
                >
                  <span className="truncate">{product.name}</span>
                  <span className="text-[10px] text-muted-foreground ml-2">
                    {(product.aliases ?? []).length} alias
                    {(product.aliases ?? []).length !== 1 ? "es" : ""}
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground p-3 text-center">No products match</p>
              )}
            </div>
          )}

          {selected && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{selected.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {(selected.aliases ?? []).length} active alias
                    {(selected.aliases ?? []).length !== 1 ? "es" : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelected(null);
                    setSuggestions([]);
                  }}
                >
                  Change
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(selected.aliases ?? []).map((alias) => (
                  <Badge key={alias} variant="secondary" className="gap-1">
                    {alias}
                    <button onClick={() => void removeAlias(alias)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {(selected.aliases ?? []).length === 0 && (
                  <p className="text-[11px] text-muted-foreground italic">
                    No aliases yet — add one below.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  value={newAlias}
                  onChange={(event) => setNewAlias(event.target.value)}
                  placeholder="e.g. kitta, mix tart"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void saveAlias(newAlias);
                  }}
                />
                <Button
                  onClick={() => void saveAlias(newAlias)}
                  disabled={saving || !newAlias.trim()}
                  size="sm"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>

              <div>
                <Button
                  onClick={() => void aiSuggest()}
                  disabled={suggesting}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  {suggesting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  AI: Suggest 5-10 nicknames
                </Button>
                {suggestions.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {suggestions.map((suggestion) => (
                      <div
                        key={suggestion}
                        className="flex items-center justify-between gap-2 text-xs px-2 py-1 rounded border"
                      >
                        <span className="truncate">{suggestion}</span>
                        <button
                          onClick={() => void saveAlias(suggestion)}
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
