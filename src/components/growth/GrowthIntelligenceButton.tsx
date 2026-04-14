import { useState } from "react";
import { Sparkles, TrendingUp, Rocket } from "lucide-react";
import { useGrowthStage } from "@/hooks/useGrowthStage";
import GrowthIntelligenceModal from "./GrowthIntelligenceModal";

const GOLD = "#c58b07";

const GrowthIntelligenceButton = ({ variant = "pill" }: { variant?: "pill" | "tile" | "hero" }) => {
  const { stage, buttonLabel, loading } = useGrowthStage();
  const [open, setOpen] = useState(false);

  if (loading) return null;

  const Icon = stage === "new" ? Rocket : stage === "growth" ? TrendingUp : Sparkles;

  if (variant === "hero") {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-2xl overflow-hidden text-left transition-all hover:shadow-lg group"
          style={{
            background: `linear-gradient(135deg, ${GOLD}18, ${GOLD}08)`,
            border: `1.5px solid ${GOLD}30`,
          }}
        >
          <div className="px-5 py-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${GOLD}15` }}>
              <Rocket size={22} style={{ color: GOLD }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm text-foreground font-medium">
                {stage === "new" ? "Are you new to Baklawa?" : buttonLabel}
              </p>
              <p className="font-body text-[10px] text-muted-foreground mt-0.5 tracking-wide">
                {stage === "new"
                  ? "Explore our curated Starters — hand-picked best sellers for first-time buyers."
                  : stage === "growth"
                    ? "Expand your range with smart reorder suggestions."
                    : "Unlock growth insights and optimize your top-performing SKUs."}
              </p>
            </div>
            <span className="text-[9px] font-ui font-bold tracking-wider uppercase px-3 py-1.5 rounded-full flex-shrink-0"
              style={{ background: GOLD, color: "#fff" }}>
              Explore
            </span>
          </div>
        </button>
        <GrowthIntelligenceModal open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

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
