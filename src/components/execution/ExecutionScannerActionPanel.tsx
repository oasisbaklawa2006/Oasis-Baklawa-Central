import { useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExecutionTouchActionButton } from "./ExecutionTouchActionButton";
import { EXECUTION_UX_LABELS } from "@/lib/execution-ux/executionUxConstants";
import type { MappedQueueItem } from "@/lib/persistent-queues/queueRowMapper";
import type { DepartmentBoardConfig } from "@/lib/execution-boards/departmentBoardConfig";
import type { useDepartmentExecutionBoard } from "@/hooks/useDepartmentExecutionBoard";

type BoardApi = Pick<
  ReturnType<typeof useDepartmentExecutionBoard>,
  "runScan" | "canWrite"
>;

export function ExecutionScannerActionPanel({
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
  const [barcode, setBarcode] = useState("");
  const [expected, setExpected] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [item.id, disabled]);

  const submitScan = (kind: "carton" | "gate" | "handoff" | "intake" | "order") => {
    if (!barcode.trim() || !expected.trim()) return;
    void api.runScan(kind, item, barcode.trim(), expected.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && config.scanCapabilities.includes("carton")) {
      e.preventDefault();
      submitScan("carton");
    }
  };

  const status = lastScanResult?.verificationStatus;
  const warnDuplicate = status === "duplicate";
  const warnMismatch = status === "mismatch" || Boolean(lastScanResult?.mismatchReason);
  const warnRejected = status === "rejected";

  return (
    <section
      className="space-y-3 rounded-lg border border-border bg-card p-3"
      aria-label="Barcode scanner panel"
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <ScanLine className="h-5 w-5 text-primary" aria-hidden />
        <span>{EXECUTION_UX_LABELS.scannerReady}</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="exec-scan-barcode" className="text-xs">
            Barcode
          </Label>
          <Input
            id="exec-scan-barcode"
            ref={inputRef}
            className="min-h-[48px] text-base"
            placeholder="Scan or type barcode"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            autoComplete="off"
            inputMode="text"
            aria-label="Barcode value"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="exec-scan-expected" className="text-xs">
            Expected
          </Label>
          <Input
            id="exec-scan-expected"
            className="min-h-[48px] text-base"
            placeholder="Expected barcode"
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            autoComplete="off"
            aria-label="Expected barcode"
          />
        </div>
      </div>

      {(warnDuplicate || warnMismatch || warnRejected) && (
        <div className="space-y-1 text-xs" role="alert">
          {warnDuplicate ? (
            <p className="rounded bg-amber-500/15 px-2 py-1 text-amber-950 dark:text-amber-100">
              Duplicate scan detected — verify before continuing.
            </p>
          ) : null}
          {warnMismatch ? (
            <p className="rounded bg-destructive/15 px-2 py-1 text-destructive">
              Mismatch — check barcode and expected value.
            </p>
          ) : null}
          {warnRejected ? (
            <div className="space-y-1">
              <p className="text-destructive">Gate rejection — reason required for audit.</p>
              <Input
                className="min-h-[44px]"
                placeholder="Rejection reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                disabled={disabled}
                aria-label="Rejection reason"
              />
            </div>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {config.scanCapabilities.includes("carton") ? (
          <ExecutionTouchActionButton
            label="Scan carton"
            variant="default"
            disabled={disabled || !barcode.trim() || !expected.trim()}
            onClick={() => submitScan("carton")}
          />
        ) : null}
        {config.scanCapabilities.includes("gate") ? (
          <ExecutionTouchActionButton
            label="Gate scan"
            variant="secondary"
            disabled={disabled || !barcode.trim() || !expected.trim()}
            onClick={() => submitScan("gate")}
          />
        ) : null}
        {config.scanCapabilities.includes("handoff") ? (
          <ExecutionTouchActionButton
            label="Handoff scan"
            variant="secondary"
            disabled={disabled || !barcode.trim() || !expected.trim()}
            onClick={() => submitScan("handoff")}
          />
        ) : null}
      </div>

      {lastScanResult?.correlationId ? (
        <p className="text-[11px] text-muted-foreground" aria-label="Scan correlation">
          Correlation: {lastScanResult.correlationId}
          {lastScanResult.eventId ? ` · Event linked` : null}
        </p>
      ) : null}
    </section>
  );
}
