export function GovernanceHandoffReferences({
  gateReference,
  completionReference,
  transporterReference,
  currentOrderStatus,
}: {
  gateReference: string | null;
  completionReference: string | null;
  transporterReference: string | null;
  currentOrderStatus: string;
}) {
  const rows = [
    { label: "Order status (live)", value: currentOrderStatus },
    { label: "gateReference", value: gateReference },
    { label: "completionReference", value: completionReference },
    { label: "transporterReference", value: transporterReference },
  ];

  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-xs">
      <p className="mb-2 font-medium">Governed handoff references (4E)</p>
      <dl className="space-y-1">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex flex-wrap justify-between gap-1">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono text-[11px]">{value?.trim() ? value : "— missing —"}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Finalize requires transporterReference (auto-derived from gate when empty). Populate missing refs on
        readiness/completion boards or security gate scans.
      </p>
    </div>
  );
}
