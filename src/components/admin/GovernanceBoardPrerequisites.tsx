import { Badge } from "@/components/ui/badge";

const MISSING_SIGNAL_LABELS: Record<string, string> = {
  finance_review_evidence: "Finance review evidence not on file",
  finance_signal_unresolved: "Finance dispatch signal unresolved",
  finance_signal_unknown: "Finance dispatch signal unknown",
  scan_mismatch_unresolved: "Unresolved barcode mismatch on dispatch lane",
  gate_scan_rejected: "Gate scan rejected",
  order_already_dispatched_observed: "Order already dispatched in operational status",
  finance_blocked_for_finalization: "Finance blocked for dispatch finalization",
  order_status_not_dispatched: "Order status is not dispatched",
  dispatch_not_finalized: "Dispatch not finalized (Phase 4E)",
  reservation_variance: "Reservation reconciliation variance",
  scan_reference_missing: "Verified scan reference missing",
  gate_reference_missing: "Gate reference missing for stock finalization",
};

function labelForMissingSignal(signal: string): string {
  if (MISSING_SIGNAL_LABELS[signal]) return MISSING_SIGNAL_LABELS[signal];
  if (signal.startsWith("balance_not_found:")) {
    return `Stock balance not found for SKU ${signal.split(":")[1] ?? "unknown"}`;
  }
  return signal.replace(/_/g, " ");
}

export function GovernanceMissingSignals({
  signals,
  title = "Missing signals",
}: {
  signals: string[];
  title?: string;
}) {
  if (signals.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase text-muted-foreground">{title}</p>
      <ul className="list-inside list-disc text-xs text-amber-800 dark:text-amber-300">
        {signals.map((s) => (
          <li key={s}>{labelForMissingSignal(s)}</li>
        ))}
      </ul>
    </div>
  );
}

export function GovernanceBlockingReasons({
  reasons,
  title = "Blocking reasons",
}: {
  reasons: string[];
  title?: string;
}) {
  if (reasons.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase text-destructive">{title}</p>
      <ul className="list-inside list-disc text-xs text-destructive">
        {reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  );
}

export function GovernanceReferencePanel({
  gateReference,
  completionReference,
  transporterReference,
}: {
  gateReference: string | null | undefined;
  completionReference: string | null | undefined;
  transporterReference: string | null | undefined;
}) {
  const rows = [
    { label: "Gate reference", value: gateReference },
    { label: "Completion reference", value: completionReference },
    { label: "Transporter reference", value: transporterReference },
  ];
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-2 text-xs space-y-1">
      <p className="font-medium text-foreground">Handoff references (read model)</p>
      {rows.map(({ label, value }) => (
        <div key={label} className="flex flex-wrap justify-between gap-1">
          <span className="text-muted-foreground">{label}</span>
          {value?.trim() ? (
            <code className="text-[11px]">{value.trim()}</code>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              missing
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}

export function GovernancePrerequisiteChecklist({
  items,
}: {
  items: { label: string; satisfied: boolean; detail?: string }[];
}) {
  return (
    <ul className="space-y-1 text-xs">
      {items.map((item) => (
        <li key={item.label} className="flex flex-wrap items-center gap-2">
          <Badge variant={item.satisfied ? "default" : "secondary"} className="text-[10px]">
            {item.satisfied ? "ok" : "pending"}
          </Badge>
          <span>{item.label}</span>
          {item.detail && <span className="text-muted-foreground">({item.detail})</span>}
        </li>
      ))}
    </ul>
  );
}

export function GovernanceActionDisabledHint({
  enabled,
  enabledLabel,
  disabledReasons,
}: {
  enabled: boolean;
  enabledLabel: string;
  disabledReasons: string[];
}) {
  if (enabled) {
    return <p className="text-xs text-emerald-700 dark:text-emerald-400">{enabledLabel}</p>;
  }
  return (
    <div className="text-xs text-muted-foreground space-y-1">
      <p className="font-medium">Action blocked</p>
      {disabledReasons.length === 0 ? (
        <p>Prerequisites not satisfied.</p>
      ) : (
        <ul className="list-inside list-disc">
          {disabledReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
