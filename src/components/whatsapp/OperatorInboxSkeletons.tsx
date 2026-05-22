import { type ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function MotionSafePulse({ className, ...props }: ComponentProps<typeof Skeleton>) {
  return <Skeleton className={cn("motion-reduce:animate-none", className)} {...props} />;
}

export function OperatorInboxPacketRowSkeleton() {
  return (
    <div className="border-b border-gray-200 p-4">
      <div className="mb-2 flex justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <MotionSafePulse className="h-4 w-3/5 max-w-[12rem]" />
          <MotionSafePulse className="h-3 w-2/5 max-w-[8rem]" />
          <div className="flex flex-wrap gap-1">
            <MotionSafePulse className="h-5 w-14" />
            <MotionSafePulse className="h-5 w-20" />
            <MotionSafePulse className="h-5 w-16" />
          </div>
        </div>
        <MotionSafePulse className="h-8 w-8 shrink-0 rounded" />
      </div>
      <MotionSafePulse className="mb-2 h-10 w-full" />
      <div className="flex justify-between">
        <MotionSafePulse className="h-6 w-24" />
        <MotionSafePulse className="h-4 w-28" />
      </div>
    </div>
  );
}

export function OperatorInboxLoadingShell() {
  return (
    <div className="flex h-[100dvh] flex-col bg-gray-100" aria-busy="true" aria-live="polite">
      <div className="border-b border-slate-200 bg-slate-50/90 px-3 py-3">
        <MotionSafePulse className="mb-2 h-3 w-40" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MotionSafePulse className="h-8 w-full" />
          <MotionSafePulse className="h-8 w-full" />
          <MotionSafePulse className="h-8 w-full" />
          <MotionSafePulse className="h-8 w-full" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex w-full max-w-none flex-col border-gray-300 bg-white lg:max-w-md lg:border-r">
          <div className="border-b border-gray-200 p-4">
            <MotionSafePulse className="mb-2 h-7 w-48" />
            <MotionSafePulse className="h-4 w-36" />
            <div className="mt-3 space-y-2">
              <MotionSafePulse className="h-9 w-full" />
              <MotionSafePulse className="h-5 w-56" />
            </div>
          </div>
          <div className="flex-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <OperatorInboxPacketRowSkeleton key={i} />
            ))}
          </div>
        </div>
        <div className="hidden min-h-0 flex-1 flex-col bg-white lg:flex">
          <div className="border-b border-amber-100 bg-amber-50/80 px-3 py-2">
            <MotionSafePulse className="h-4 w-full max-w-md" />
          </div>
          <div className="border-b border-gray-200 bg-green-50 p-4">
            <MotionSafePulse className="mb-2 h-4 w-32" />
            <MotionSafePulse className="mb-2 h-6 w-64" />
            <MotionSafePulse className="h-4 w-48" />
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4">
            <MotionSafePulse className="h-24 w-full max-w-xl" />
            <MotionSafePulse className="h-24 w-full max-w-md self-end" />
            <MotionSafePulse className="h-24 w-full max-w-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
