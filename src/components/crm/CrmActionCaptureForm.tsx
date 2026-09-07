import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  captureCrmManualAction,
  captureCrmWhatsAppManualLog,
  captureEmailIntent,
  newCrmActionIdempotencyKey,
  type CrmActionSurfaceSource,
} from "@/lib/crm-action-capture";
import { isAccountManagerEligibleUser } from "@/lib/client-governance/accountManagerRoles";
import { normalizeRole } from "@/lib/roleNormalization";

type CaptureKind = "call" | "note" | "promise" | "whatsapp_log" | "email_intent";

export function CrmActionCaptureForm({
  companyId,
  actorUserId,
  actorRole,
  captureSource,
  onCaptured,
}: {
  companyId: string;
  actorUserId: string;
  actorRole: string | null;
  captureSource: CrmActionSurfaceSource;
  onCaptured?: () => void;
}) {
  const [kind, setKind] = useState<CaptureKind>("call");
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailRecipient, setEmailRecipient] = useState("");
  const [saving, setSaving] = useState(false);

  const normalizedRole = normalizeRole(actorRole);
  const isInternalStaff =
    isAccountManagerEligibleUser(actorRole) && normalizedRole !== "SALES_EXECUTIVE";

  const sharedContext = {
    executiveId: actorUserId,
    actorRole,
    isInternalStaff,
    captureSource,
  };

  const handleSubmit = async () => {
    setSaving(true);
    const idempotencyKey = newCrmActionIdempotencyKey(`c360-${kind}`);

    try {
      if (kind === "email_intent") {
        if (!emailSubject.trim() || !notes.trim()) {
          toast.error("Email intent requires subject and body preview.");
          return;
        }
        const result = await captureEmailIntent({
          ...sharedContext,
          companyId,
          subject: emailSubject.trim(),
          body: notes.trim(),
          recipientEmail: emailRecipient.trim() || null,
          idempotencyKey,
        });
        if (result.ok === false) {
          toast.error(result.message);
          return;
        }
      } else if (kind === "whatsapp_log") {
        if (!notes.trim()) {
          toast.error("Notes are required.");
          return;
        }
        const result = await captureCrmWhatsAppManualLog({
          ...sharedContext,
          companyId,
          notes: notes.trim(),
          outcome: outcome.trim() || null,
          followUpDate: followUpDate || null,
          idempotencyKey,
        });
        if (result.ok === false) {
          toast.error(result.message);
          return;
        }
      } else {
        if (!notes.trim()) {
          toast.error("Notes are required.");
          return;
        }
        if (kind === "promise" && !followUpDate) {
          toast.error("Promises require an explicit follow-up date.");
          return;
        }
        const result = await captureCrmManualAction({
          ...sharedContext,
          companyId,
          channel: kind,
          notes: notes.trim(),
          outcome: outcome.trim() || null,
          followUpDate: followUpDate || null,
          idempotencyKey,
        });
        if (result.ok === false) {
          toast.error(result.message);
          return;
        }
      }

      toast.success("Governed action captured.");
      setNotes("");
      setOutcome("");
      setFollowUpDate("");
      setEmailSubject("");
      setEmailRecipient("");
      onCaptured?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4" data-point="62">
      <p className="text-sm font-medium">Capture governed action (Point 62)</p>
      <p className="text-xs text-muted-foreground">
        Records durable intent through Core <code className="rounded bg-muted px-1">client_interactions</code>.
        Email records intent only; provider sends never claim delivery without canonical provider result.
      </p>
      <Select value={kind} onValueChange={(value) => setKind(value as CaptureKind)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="call">Call</SelectItem>
          <SelectItem value="note">Note</SelectItem>
          <SelectItem value="promise">Promise / commitment</SelectItem>
          <SelectItem value="whatsapp_log">WhatsApp (manual log)</SelectItem>
          <SelectItem value="email_intent">Email (intent only)</SelectItem>
        </SelectContent>
      </Select>
      {kind === "email_intent" && (
        <>
          <Input
            value={emailRecipient}
            onChange={(event) => setEmailRecipient(event.target.value)}
            placeholder="Recipient email (optional)"
          />
          <Input
            value={emailSubject}
            onChange={(event) => setEmailSubject(event.target.value)}
            placeholder="Subject *"
          />
        </>
      )}
      <Textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder={kind === "email_intent" ? "Body preview *" : "Notes *"}
      />
      {kind !== "email_intent" && (
        <Input
          value={outcome}
          onChange={(event) => setOutcome(event.target.value)}
          placeholder="Outcome (optional)"
        />
      )}
      {(kind === "promise" || kind === "whatsapp_log" || kind === "call") && (
        <Input
          type="date"
          value={followUpDate}
          onChange={(event) => setFollowUpDate(event.target.value)}
        />
      )}
      <Button type="button" onClick={() => void handleSubmit()} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Capture action
      </Button>
    </div>
  );
}
