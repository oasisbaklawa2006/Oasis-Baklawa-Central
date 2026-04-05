import { useMemo } from "react";

interface Props {
  createdAt: string | null;
  className?: string;
}

export default function StagnancyBadge({ createdAt, className = "" }: Props) {
  const { label, tier } = useMemo(() => {
    if (!createdAt) return { label: "—", tier: "neutral" as const };
    const diffMs = Date.now() - new Date(createdAt).getTime();
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    const label = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    const tier = hours >= 6 ? "red" : hours >= 4 ? "amber" : "neutral";
    return { label, tier };
  }, [createdAt]);

  const tierStyles = {
    neutral: "bg-muted text-muted-foreground",
    amber: "bg-amber-500/20 text-amber-600 border border-amber-400/40",
    red: "bg-red-600 text-white animate-pulse",
  };

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[3rem] px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none
        ${tierStyles[tier]}
        ${className}`}
    >
      {label}
    </span>
  );
}
