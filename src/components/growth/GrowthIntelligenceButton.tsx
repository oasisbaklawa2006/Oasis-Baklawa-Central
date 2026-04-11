import { useState } from "react";
import { Sparkles, TrendingUp, Rocket } from "lucide-react";
import { useGrowthStage } from "@/hooks/useGrowthStage";
import GrowthIntelligenceModal from "./GrowthIntelligenceModal";

const GOLD = "#c58b07";

const GrowthIntelligenceButton = ({ variant = "pill" }: { variant?: "pill" | "tile" }) => {
  const { stage, buttonLabel, loading } = useGrowthStage();
  const [open, setOpen] = useState(false);

  if (loading) return null;

  const Icon = stage === "new" ? Rocket : stage === "growth" ? TrendingUp : Sparkles;

  if (variant === "tile") {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="bg-card p-4 rounded-2xl border-2 hover:shadow-md transition-all text-left w-full"
          style={{ borderColor: `${GOLD}40` }}
        >
          <Icon size={16} style={{ color: GOLD }} className="mb-2" />
          <p className="text-xs font-bold text-foreground">{buttonLabel}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {stage === "new" ? "Build your first order" : stage === "growth" ? "Expand your range" : "Optimize performance"}
          </p>
        </button>
        <GrowthIntelligenceModal open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all hover:shadow-sm"
        style={{ borderColor: GOLD, color: GOLD }}
      >
        <Icon size={14} />
        {buttonLabel}
      </button>
      <GrowthIntelligenceModal open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default GrowthIntelligenceButton;
