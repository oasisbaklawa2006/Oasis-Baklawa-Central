import { AlertTriangle } from "lucide-react";

export function GovernancePrerequisiteList({
  title = "Prerequisites & blockers",
  items,
  emptyLabel = "None",
  variant = "default",
}: {
  title?: string;
  items: string[];
  emptyLabel?: string;
  variant?: "default" | "destructive";
}) {
  if (items.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        <p className="font-medium uppercase tracking-wide">{title}</p>
        <p className="mt-1">{emptyLabel}</p>
      </div>
    );
  }

  const listClass =
    variant === "destructive"
      ? "list-inside list-disc text-xs text-destructive"
      : "list-inside list-disc text-xs text-muted-foreground";

  return (
    <div>
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {variant === "destructive" && <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />}
        {title}
      </p>
      <ul className={`mt-1 ${listClass}`}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
