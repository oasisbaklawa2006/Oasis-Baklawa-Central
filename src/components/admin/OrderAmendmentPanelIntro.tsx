import { ShieldAlert } from "lucide-react";

/** Point 75 governed-change panel header (extracted for Codacy/ESLint line hygiene). */
export function OrderAmendmentPanelIntro() {
  return (
    <div className="flex items-start gap-2">
      <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
      <div>
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Governed order change (Point 75)
        </h3>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Amendment, cancellation and substitution route only through Core RPC authority. No direct order or line
          mutation from Central.
        </p>
      </div>
    </div>
  );
}
