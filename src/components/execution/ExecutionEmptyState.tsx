import { Inbox } from "lucide-react";

export function ExecutionEmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center"
      role="status"
      aria-label={title}
    >
      <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="max-w-sm text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}
