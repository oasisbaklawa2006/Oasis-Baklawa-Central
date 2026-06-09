import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type OperationalStatusKind =
  | "live"
  | "preview-only"
  | "local-only"
  | "not-persisted"
  | "does-not-create-so"
  | "demo-data";

const CONFIG: Record<OperationalStatusKind, { text: string; className: string }> = {
  live: {
    text: "LIVE",
    className: "border-emerald-600/50 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100",
  },
  "preview-only": {
    text: "PREVIEW ONLY",
    className: "border-amber-600/50 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100",
  },
  "local-only": {
    text: "LOCAL ONLY",
    className: "border-slate-500/50 bg-slate-100 text-slate-900 dark:bg-slate-900/40 dark:text-slate-100",
  },
  "not-persisted": {
    text: "NOT PERSISTED",
    className: "border-orange-600/50 bg-orange-50 text-orange-950 dark:bg-orange-950/30 dark:text-orange-100",
  },
  "does-not-create-so": {
    text: "DOES NOT CREATE SALES ORDER",
    className: "border-red-600/50 bg-red-50 text-red-950 dark:bg-red-950/30 dark:text-red-100",
  },
  "demo-data": {
    text: "DEMO DATA",
    className: "border-violet-600/50 bg-violet-50 text-violet-950 dark:bg-violet-950/30 dark:text-violet-100",
  },
};

export function OperationalStatusLabel({
  kind,
  className,
}: {
  kind: OperationalStatusKind;
  className?: string;
}) {
  const cfg = CONFIG[kind];
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-semibold uppercase tracking-wide", cfg.className, className)}
    >
      {cfg.text}
    </Badge>
  );
}

/** Block governed board writes on preview/sample cards or non-Supabase persistence. */
export function governanceWritesBlocked(args: {
  showPreviewCards: boolean;
  persistenceMode?: string | null;
  canExecuteWrites?: boolean;
}): boolean {
  if (args.showPreviewCards) return true;
  if (args.persistenceMode !== "supabase") return true;
  return !args.canExecuteWrites;
}
