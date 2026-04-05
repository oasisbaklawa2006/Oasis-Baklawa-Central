import { useMemo } from "react";

interface Props {
  createdAt: string | null;
  className?: string;
}

export default function StagnancyBadge({ createdAt, className = "" }: Props) {
  const { label, isStale } = useMemo(() => {
    if (!createdAt) return { label: "—", isStale: false };
    const diffMs = Date.now() - new Date(createdAt).getTime();
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    const label = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    return { label, isStale: hours >= 6 };
  }, [createdAt]);

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[3rem] px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none
        ${isStale ? "bg-red-600 text-white animate-pulse" : "bg-muted text-muted-foreground"}
        ${className}`}
    >
      {label}
    </span>
  );
}
