import { Skeleton } from "@/components/ui/skeleton";

export function ExecutionSkeletonState() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading execution board">
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-3 md:grid-cols-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
