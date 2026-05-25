import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MappedQueueItem } from "@/lib/persistent-queues/queueRowMapper";
import type { DepartmentBoardConfig } from "@/lib/execution-boards/departmentBoardConfig";
import type { useDepartmentExecutionBoard } from "@/hooks/useDepartmentExecutionBoard";

type BoardApi = Pick<
  ReturnType<typeof useDepartmentExecutionBoard>,
  "runWrite" | "runScan" | "canWrite"
>;

export function ExecutionActionBar({
  item,
  config,
  api,
}: {
  item: MappedQueueItem;
  config: DepartmentBoardConfig;
  api: BoardApi;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [barcode, setBarcode] = useState("");
  const [expected, setExpected] = useState("");
  const disabled = !api.canWrite;

  const base = { queueItemId: item.id, expectedVersion: item.version };

  return (
    <div className="flex flex-wrap gap-2 border-t border-border pt-3">
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled}
        onClick={() => void api.runWrite((e, c) => e.acknowledgeQueueItem(base, c))}
      >
        Acknowledge
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled}
        onClick={() =>
          void api.runWrite((e, c) =>
            e.assignQueueItem({ ...base, toUserId: null, reason: reason || "Reassign" }, c),
          )
        }
      >
        Assign
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled}
        onClick={() => void api.runWrite((e, c) => e.startQueueItem(base, c))}
      >
        Start
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled || !reason.trim()}
        onClick={() =>
          void api.runWrite((e, c) =>
            e.blockQueueItem({ ...base, reason, blockerSummary: reason }, c),
          )
        }
      >
        Block
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled || !reason.trim()}
        onClick={() =>
          void api.runWrite((e, c) => e.escalateQueueItem({ ...base, reason }, c))
        }
      >
        Escalate
      </Button>
      <Button
        size="sm"
        variant="default"
        disabled={disabled}
        onClick={() => void api.runWrite((e, c) => e.completeQueueItem(base, c))}
      >
        Complete
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={disabled || !reason.trim()}
        onClick={() => void api.runWrite((e, c) => e.failQueueItem({ ...base, reason }, c))}
      >
        Fail
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || !reason.trim()}
        onClick={() => void api.runWrite((e, c) => e.cancelQueueItem({ ...base, reason }, c))}
      >
        Cancel
      </Button>
      <Input
        className="h-9 min-w-[140px] flex-1"
        placeholder="Reason (block/fail/cancel/escalate)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={disabled}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || !note.trim()}
        onClick={() => void api.runWrite((e, c) => e.addOperationalNote({ queueItemId: item.id, note }, c))}
      >
        Note
      </Button>
      <Input
        className="h-9 min-w-[120px]"
        placeholder="Operational note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={disabled}
      />
      {config.scanCapabilities.includes("carton") ? (
        <>
          <Input className="h-9 w-28" placeholder="Barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
          <Input className="h-9 w-28" placeholder="Expected" value={expected} onChange={(e) => setExpected(e.target.value)} />
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || !barcode.trim() || !expected.trim()}
            onClick={() => void api.runScan("carton", item, barcode, expected)}
          >
            Scan carton
          </Button>
        </>
      ) : null}
      {config.scanCapabilities.includes("gate") ? (
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || !barcode.trim() || !expected.trim()}
          onClick={() => void api.runScan("gate", item, barcode, expected, { gateId: "main-gate" })}
        >
          Gate scan
        </Button>
      ) : null}
    </div>
  );
}
