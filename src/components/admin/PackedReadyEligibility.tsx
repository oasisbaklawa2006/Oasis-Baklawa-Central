import type { PackedReadyBlocker } from "@/utils/packedReadyGate";

interface Props {
  blockers: PackedReadyBlocker[];
  className?: string;
}

/** Dispatch / admin surfaces — Phase 2B packed_ready gate feedback. */
export function PackedReadyEligibilityCard({ blockers, className }: Props) {
  const ok = blockers.length === 0;
  return (
    <div
      className={`rounded-xl border p-3 text-xs ${
        ok ? "border-emerald-500/40 bg-emerald-500/10" : "border-destructive/40 bg-destructive/10"
      } ${className ?? ""}`}
    >
      <p className={`font-bold ${ok ? "text-emerald-800 dark:text-emerald-200" : "text-destructive"}`}>
        {ok ? "Eligible for packed_ready" : "Blocked from packed_ready"}
      </p>
      {!ok && (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
          {blockers.map((b, i) => (
            <li key={`${b.reason}-${i}`}>{b.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
