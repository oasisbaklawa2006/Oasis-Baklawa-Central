import { useState } from "react";
import {
  Ban,
  CheckCircle2,
  Play,
  ShieldAlert,
  StickyNote,
  UserPlus,
  XCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MappedQueueItem } from "@/lib/persistent-queues/queueRowMapper";
import type { DepartmentBoardConfig } from "@/lib/execution-boards/departmentBoardConfig";
import type { useDepartmentExecutionBoard } from "@/hooks/useDepartmentExecutionBoard";
import { ExecutionOperatorConfirmDialog } from "./ExecutionOperatorConfirmDialog";
import { ExecutionScannerActionPanel } from "./ExecutionScannerActionPanel";
import { ExecutionTouchActionButton } from "./ExecutionTouchActionButton";

type BoardApi = Pick<
  ReturnType<typeof useDepartmentExecutionBoard>,
  "runWrite" | "runScan" | "canWrite"
>;

type ConfirmKind = "complete" | "fail" | "cancel" | null;

export function ExecutionActionBar({
  item,
  config,
  api,
  disabled,
  lastScanResult,
}: {
  item: MappedQueueItem;
  config: DepartmentBoardConfig;
  api: BoardApi;
  disabled: boolean;
  lastScanResult?: {
    correlationId?: string;
    eventId?: string;
    verificationStatus?: string;
    mismatchReason?: string | null;
  } | null;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);

  const base = { queueItemId: item.id, expectedVersion: item.version };

  const runConfirmed = (kind: ConfirmKind) => {
    if (!kind) return;
    if (kind === "complete") void api.runWrite((e, c) => e.completeQueueItem(base, c));
    if (kind === "fail" && reason.trim()) void api.runWrite((e, c) => e.failQueueItem({ ...base, reason }, c));
    if (kind === "cancel" && reason.trim()) void api.runWrite((e, c) => e.cancelQueueItem({ ...base, reason }, c));
    setConfirmKind(null);
  };

  return (
    <div className="space-y-4 border-t border-border pt-4">
      {config.scanCapabilities.length > 0 ? (
        <ExecutionScannerActionPanel
          item={item}
          config={config}
          api={api}
          disabled={disabled}
          lastScanResult={lastScanResult}
        />
      ) : null}

      <div
        className="sticky bottom-0 z-10 -mx-1 flex flex-wrap gap-2 rounded-t-lg border border-border bg-background/95 p-3 backdrop-blur"
        role="toolbar"
        aria-label="Queue actions"
      >
        <ExecutionTouchActionButton
          label="Acknowledge"
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
          variant="secondary"
          disabled={disabled}
          onClick={() => void api.runWrite((e, c) => e.acknowledgeQueueItem(base, c))}
        />
        <ExecutionTouchActionButton
          label="Assign"
          icon={<UserPlus className="h-4 w-4" aria-hidden />}
          variant="secondary"
          disabled={disabled}
          onClick={() =>
            void api.runWrite((e, c) =>
              e.assignQueueItem({ ...base, toUserId: null, reason: reason || "Reassign" }, c),
            )
          }
        />
        <ExecutionTouchActionButton
          label="Start"
          icon={<Play className="h-4 w-4" aria-hidden />}
          variant="secondary"
          disabled={disabled}
          onClick={() => void api.runWrite((e, c) => e.startQueueItem(base, c))}
        />
        <ExecutionTouchActionButton
          label="Block"
          icon={<Ban className="h-4 w-4" aria-hidden />}
          variant="secondary"
          disabled={disabled || !reason.trim()}
          onClick={() =>
            void api.runWrite((e, c) =>
              e.blockQueueItem({ ...base, reason, blockerSummary: reason }, c),
            )
          }
        />
        <ExecutionTouchActionButton
          label="Escalate"
          icon={<ShieldAlert className="h-4 w-4" aria-hidden />}
          variant="secondary"
          disabled={disabled || !reason.trim()}
          onClick={() => void api.runWrite((e, c) => e.escalateQueueItem({ ...base, reason }, c))}
        />
        <ExecutionTouchActionButton
          label="Complete"
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
          variant="default"
          disabled={disabled}
          onClick={() => setConfirmKind("complete")}
        />
        <ExecutionTouchActionButton
          label="Fail"
          icon={<XCircle className="h-4 w-4" aria-hidden />}
          variant="destructive"
          disabled={disabled || !reason.trim()}
          onClick={() => setConfirmKind("fail")}
        />
        <ExecutionTouchActionButton
          label="Cancel"
          variant="outline"
          disabled={disabled || !reason.trim()}
          onClick={() => setConfirmKind("cancel")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="exec-action-reason" className="text-xs">
          Reason (block / fail / cancel / escalate)
        </Label>
        <Input
          id="exec-action-reason"
          className="min-h-[48px] text-base"
          placeholder="Required for block, fail, cancel, escalate"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={disabled}
          aria-label="Action reason"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <ExecutionTouchActionButton
          label="Add note"
          icon={<StickyNote className="h-4 w-4" aria-hidden />}
          variant="outline"
          disabled={disabled || !note.trim()}
          onClick={() => void api.runWrite((e, c) => e.addOperationalNote({ queueItemId: item.id, note }, c))}
        />
        <Input
          className="min-h-[44px] flex-1 text-base"
          placeholder="Operational note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={disabled}
          aria-label="Operational note text"
        />
      </div>

      <ExecutionOperatorConfirmDialog
        open={confirmKind === "complete"}
        onOpenChange={(o) => !o && setConfirmKind(null)}
        title="Complete queue item?"
        description="Marks this work item complete. Emits an operational event — does not finish dispatch or stock."
        confirmLabel="Complete"
        onConfirm={() => runConfirmed("complete")}
      />
      <ExecutionOperatorConfirmDialog
        open={confirmKind === "fail"}
        onOpenChange={(o) => !o && setConfirmKind(null)}
        title="Fail queue item?"
        description={`Reason: ${reason}`}
        confirmLabel="Fail"
        destructive
        onConfirm={() => runConfirmed("fail")}
      />
      <ExecutionOperatorConfirmDialog
        open={confirmKind === "cancel"}
        onOpenChange={(o) => !o && setConfirmKind(null)}
        title="Cancel queue item?"
        description={`Reason: ${reason}`}
        confirmLabel="Cancel"
        destructive
        onConfirm={() => runConfirmed("cancel")}
      />
    </div>
  );
}
