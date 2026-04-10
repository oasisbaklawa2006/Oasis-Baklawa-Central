import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Phone, MapPin, StickyNote, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";

interface Company {
  id: string;
  business_name: string;
}

interface Interaction {
  id: string;
  company_id: string | null;
  interaction_type: string | null;
  notes: string | null;
  outcome: string | null;
  follow_up_date: string | null;
  created_at: string | null;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  call: <Phone size={14} className="text-blue-500" />,
  whatsapp: <MessageSquare size={14} className="text-green-500" />,
  visit: <MapPin size={14} className="text-emerald-500" />,
  note: <StickyNote size={14} className="text-amber-500" />,
};

export default function ClientInteractionsTab({
  companies,
  userId,
}: {
  companies: Company[];
  userId: string | undefined;
}) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterCompany, setFilterCompany] = useState<string>("all");

  // Form
  const [formCompany, setFormCompany] = useState("");
  const [formType, setFormType] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formOutcome, setFormOutcome] = useState("");
  const [formFollowUp, setFormFollowUp] = useState("");
  const [saving, setSaving] = useState(false);

  const companyIds = companies.map((c) => c.id);

  const fetchInteractions = async () => {
    if (companyIds.length === 0) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("client_interactions")
      .select("id, company_id, interaction_type, notes, outcome, follow_up_date, created_at")
      .in("company_id", companyIds)
      .order("created_at", { ascending: false })
      .limit(100);
    setInteractions(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchInteractions(); }, [companies]);

  const handleSubmit = async () => {
    if (!formCompany || !formType) {
      toast.error("Select a client and activity type.");
      return;
    }
    if (!formNotes.trim()) {
      toast.error("Notes cannot be empty. Describe the interaction.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("client_interactions").insert({
      company_id: formCompany,
      executive_id: userId || null,
      interaction_type: formType,
      notes: formNotes.trim(),
      outcome: formOutcome.trim() || null,
      follow_up_date: formFollowUp || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Failed: " + error.message);
    } else {
      toast.success("Activity logged.");
      setShowModal(false);
      setFormCompany("");
      setFormType("");
      setFormNotes("");
      setFormOutcome("");
      setFormFollowUp("");
      fetchInteractions();
    }
  };

  const companyMap: Record<string, string> = {};
  companies.forEach((c) => { companyMap[c.id] = c.business_name; });

  const filtered = filterCompany === "all"
    ? interactions
    : interactions.filter((i) => i.company_id === filterCompany);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select value={filterCompany} onValueChange={setFilterCompany}>
          <SelectTrigger className="w-56 bg-card border-border">
            <SelectValue placeholder="Filter by client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowModal(true)} className="gap-2" size="sm">
          <Plus size={14} /> Log Activity
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No interactions logged yet.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((int) => (
            <div key={int.id} className="flex gap-3 items-start bg-card border border-border rounded-xl p-4">
              <div className="mt-1">{TYPE_ICONS[int.interaction_type || "note"] || TYPE_ICONS.note}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase text-muted-foreground">
                    {int.interaction_type || "Note"}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs font-semibold text-foreground">
                    {int.company_id ? companyMap[int.company_id] || "Unknown" : "—"}
                  </span>
                </div>
                {int.notes && <p className="text-sm text-foreground mt-1">{int.notes}</p>}
                {int.outcome && (
                  <div className="mt-1">
                    <Badge variant="secondary" className="text-xs">Outcome: {int.outcome}</Badge>
                  </div>
                )}
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  {int.created_at && <span>{format(new Date(int.created_at), "dd MMM yyyy, HH:mm")}</span>}
                  {int.follow_up_date && (
                    <span className="text-amber-600 font-semibold">Follow-up: {format(new Date(int.follow_up_date), "dd MMM yyyy")}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log Activity Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus size={18} className="text-primary" /> Log Client Activity
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-semibold text-muted-foreground mb-1 block">Client *</label>
              <Select value={formCompany} onValueChange={setFormCompany}>
                <SelectTrigger><SelectValue placeholder="Select Client" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground mb-1 block">Activity Type *</label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">📞 Call</SelectItem>
                  <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                  <SelectItem value="visit">📍 Visit</SelectItem>
                  <SelectItem value="note">📝 Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground mb-1 block">Notes *</label>
              <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Details of interaction (required)..." />
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground mb-1 block">Outcome</label>
              <Input value={formOutcome} onChange={(e) => setFormOutcome(e.target.value)} placeholder="e.g. Order confirmed, Will call back" />
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground mb-1 block">Follow-up Date</label>
              <Input type="date" value={formFollowUp} onChange={(e) => setFormFollowUp(e.target.value)} />
            </div>
            <Button onClick={handleSubmit} disabled={saving} className="w-full gap-2">
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              Log Activity
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
