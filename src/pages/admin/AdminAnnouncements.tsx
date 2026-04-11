import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Eye, Pencil, BarChart3, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AnimatePresence, motion } from "framer-motion";

interface Announcement {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  video_url: string | null;
  priority: string;
  target_audience: string;
  target_region: string | null;
  display_duration: number;
  trigger_delay: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  cta_text: string | null;
  cta_link: string | null;
  view_count: number;
  skip_count: number;
  completion_count: number;
  created_at: string;
}

const EMPTY: Partial<Announcement> = {
  title: "",
  subtitle: "",
  image_url: "",
  video_url: "",
  priority: "greeting",
  target_audience: "all",
  target_region: "",
  display_duration: 8,
  trigger_delay: 10,
  start_date: new Date().toISOString().slice(0, 16),
  end_date: "",
  is_active: true,
  cta_text: "",
  cta_link: "",
};

const AdminAnnouncements = () => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [form, setForm] = useState<Partial<Announcement>>(EMPTY);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("premium_announcements")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data as Announcement[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSave = async () => {
    if (!form.title) { toast.error("Title is required"); return; }
    setSaving(true);
    const payload = {
      title: form.title,
      subtitle: form.subtitle || null,
      image_url: form.image_url || null,
      video_url: form.video_url || null,
      priority: form.priority || "greeting",
      target_audience: form.target_audience || "all",
      target_region: form.target_region || null,
      display_duration: form.display_duration ?? 8,
      trigger_delay: form.trigger_delay ?? 10,
      start_date: form.start_date || new Date().toISOString(),
      end_date: form.end_date || null,
      is_active: form.is_active ?? true,
      cta_text: form.cta_text || null,
      cta_link: form.cta_link || null,
    };

    if (form.id) {
      const { error } = await supabase.from("premium_announcements").update(payload).eq("id", form.id);
      if (error) toast.error(error.message); else toast.success("Updated");
    } else {
      const { error } = await supabase.from("premium_announcements").insert(payload);
      if (error) toast.error(error.message); else toast.success("Created");
    }
    setSaving(false);
    setEditOpen(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    await supabase.from("premium_announcements").delete().eq("id", id);
    toast.success("Deleted");
    fetchAll();
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from("premium_announcements").update({ is_active: active }).eq("id", id);
    fetchAll();
  };

  const priorityColor: Record<string, string> = {
    critical: "bg-red-100 text-red-700",
    offer: "bg-amber-100 text-amber-700",
    launch: "bg-teal-100 text-teal-700",
    greeting: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Premium Announcements
          </h2>
          <p className="text-xs text-muted-foreground">Manage full-screen promotional overlays for buyers</p>
        </div>
        <button
          onClick={() => { setForm(EMPTY); setEditOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #c58b07, #d4a843)" }}
        >
          <Plus size={14} /> New Announcement
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No announcements yet</div>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <div key={item.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-4"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
              {/* Thumb */}
              <div className="w-20 h-14 rounded-lg overflow-hidden bg-muted shrink-0">
                {item.image_url ? (
                  <img src={item.image_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg">✨</div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${priorityColor[item.priority] ?? ""}`}>
                    {item.priority}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {item.target_audience === "all" ? "All Users" : item.target_audience}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-foreground truncate">{item.title}</h3>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><BarChart3 size={10} /> {item.view_count} views</span>
                  <span>{item.skip_count} skips</span>
                  <span>{item.completion_count} completions</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={item.is_active} onCheckedChange={(v) => handleToggle(item.id, v)} />
                <button onClick={() => { setForm(item); setPreviewOpen(true); }} className="p-1.5 rounded-lg hover:bg-muted"><Eye size={14} className="text-muted-foreground" /></button>
                <button onClick={() => { setForm({ ...item, start_date: item.start_date?.slice(0, 16), end_date: item.end_date?.slice(0, 16) ?? "" }); setEditOpen(true); }} className="p-1.5 rounded-lg hover:bg-muted"><Pencil size={14} className="text-muted-foreground" /></button>
                <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-destructive/10"><Trash2 size={14} className="text-destructive" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit" : "New"} Announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-foreground">Title *</label>
              <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Subtitle</label>
              <Textarea value={form.subtitle ?? ""} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground">Image URL</label>
                <Input value={form.image_url ?? ""} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Video URL</label>
                <Input value={form.video_url ?? ""} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="https://..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground">Priority</label>
                <Select value={form.priority ?? "greeting"} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">🔴 Critical</SelectItem>
                    <SelectItem value="offer">🟡 Offer</SelectItem>
                    <SelectItem value="launch">🟢 Launch</SelectItem>
                    <SelectItem value="greeting">💬 Greeting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Audience</label>
                <Select value={form.target_audience ?? "all"} onValueChange={(v) => setForm({ ...form, target_audience: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="new">New Users</SelectItem>
                    <SelectItem value="region">Region-based</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.target_audience === "region" && (
              <div>
                <label className="text-xs font-semibold text-foreground">Target Region</label>
                <Input value={form.target_region ?? ""} onChange={(e) => setForm({ ...form, target_region: e.target.value })} placeholder="e.g. Maharashtra" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground">Display Duration (sec)</label>
                <Input type="number" min={6} max={30} value={form.display_duration ?? 8} onChange={(e) => setForm({ ...form, display_duration: parseInt(e.target.value) || 8 })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Trigger Delay (sec)</label>
                <Input type="number" min={0} max={60} value={form.trigger_delay ?? 10} onChange={(e) => setForm({ ...form, trigger_delay: parseInt(e.target.value) || 10 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground">Start Date</label>
                <Input type="datetime-local" value={form.start_date ?? ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">End Date</label>
                <Input type="datetime-local" value={form.end_date ?? ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground">CTA Text</label>
                <Input value={form.cta_text ?? ""} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} placeholder="Shop Now" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">CTA Link</label>
                <Input value={form.cta_link ?? ""} onChange={(e) => setForm({ ...form, cta_link: e.target.value })} placeholder="/catalogue" />
              </div>
            </div>
            <div className="flex justify-between items-center pt-2">
              <button onClick={() => { setPreviewOpen(true); }} className="text-xs font-semibold" style={{ color: "#c58b07" }}>
                <Eye size={14} className="inline mr-1" /> Preview
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #c58b07, #d4a843)" }}>
                {saving ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
                {form.id ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden bg-transparent border-0">
          <div className="bg-card rounded-2xl overflow-hidden border border-border" style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.35)" }}>
            {form.video_url ? (
              <video src={form.video_url} autoPlay muted loop playsInline className="w-full aspect-[16/10] object-cover" />
            ) : form.image_url ? (
              <img src={form.image_url} className="w-full aspect-[16/10] object-cover" alt="" />
            ) : (
              <div className="w-full aspect-[16/10] bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.6)] flex items-center justify-center">
                <span className="text-5xl">✨</span>
              </div>
            )}
            <div className="p-6 text-center space-y-2">
              <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
                {form.title || "Announcement Title"}
              </h2>
              {form.subtitle && <p className="text-sm text-muted-foreground">{form.subtitle}</p>}
              {form.cta_text && (
                <span className="inline-block px-5 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: "linear-gradient(135deg, #c58b07, #d4a843)" }}>
                  {form.cta_text}
                </span>
              )}
            </div>
            <div className="px-6 pb-5 space-y-2">
              <div className="text-center text-xs font-semibold" style={{ color: "#c58b07" }}>
                Ad ends in {form.display_duration ?? 8}s
              </div>
              <button className="w-full py-2.5 rounded-xl text-xs font-semibold border" style={{ borderColor: "#c58b07", color: "#c58b07" }}>
                Continue to Dashboard
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAnnouncements;
