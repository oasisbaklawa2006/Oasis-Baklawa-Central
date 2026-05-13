import type { FinanceReleaseState } from "@/utils/financeReleaseState";

type ChipTone = "default" | "success" | "warn" | "destructive" | "muted";

function toneClass(tone: ChipTone): string {
  switch (tone) {
    case "success":
      return "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100";
    case "warn":
      return "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100";
    case "destructive":
      return "border-red-300 bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100";
    case "muted":
      return "border-border bg-muted/50 text-muted-foreground";
    default:
      return "border-border bg-card text-foreground";
  }
}

interface FinanceReleaseChipsProps {
  state: FinanceReleaseState;
  variant?: "admin" | "compact";
  className?: string;
}

/**
 * Read-only chips for Phase 2C finance visibility. Parent computes `deriveFinanceReleaseState`.
 */
export function FinanceReleaseChips({ state, variant = "admin", className = "" }: FinanceReleaseChipsProps) {
  const labels =
    variant === "admin"
      ? {
          awaiting: "Awaiting Advance",
          advanceOk: "Advance Verified",
          balance: "Balance Pending",
          hold: "Finance Hold",
          released: "Finance Released",
        }
      : {
          awaiting: "awaiting advance",
          advanceOk: "advance verified",
          balance: "balance pending",
          hold: "finance hold",
          released: "finance released",
        };

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      <span
        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${state.awaiting_advance ? toneClass("warn") : toneClass("muted")}`}
        title={state.awaiting_advance ? "Advance still required or not verified" : "Not awaiting advance"}
      >
        {labels.awaiting}
      </span>
      <span
        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${state.advance_verified ? toneClass("success") : toneClass("muted")}`}
        title={state.advance_verified ? "Required advance threshold met" : "Advance threshold not met"}
      >
        {labels.advanceOk}
      </span>
      <span
        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${state.balance_pending ? toneClass("warn") : toneClass("muted")}`}
        title={state.balance_pending ? "Invoice/total not fully paid" : "No balance flagged pending"}
      >
        {labels.balance}
      </span>
      <span
        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${state.finance_hold ? toneClass("destructive") : toneClass("muted")}`}
        title={
          state.finance_hold
            ? "Finance is blocking operations and/or dispatch"
            : "No aggregate finance block on pipeline lanes"
        }
      >
        {labels.hold}
      </span>
      <span
        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${state.finance_released ? toneClass("success") : toneClass("muted")}`}
        title={state.finance_released ? "Released for current finance checks" : "Not in a released state"}
      >
        {labels.released}
      </span>
    </div>
  );
}
