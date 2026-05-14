import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { DollarSign } from "lucide-react";

export function FinanceBoardCard() {
  const navigate = useNavigate();

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="h-full"
    >
      <button
        type="button"
        onClick={() => navigate("/admin/finance-board")}
        className="w-full h-full flex flex-col text-left rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition-colors"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#B8860B]/15 flex items-center justify-center">
            <DollarSign size={20} className="text-[#B8860B]" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Governance
          </span>
        </div>
        <h3 className="font-display font-bold text-lg text-foreground">Finance Release Board</h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Verify payments · Approve credit · Release to production
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md bg-muted text-muted-foreground">
            Payment Verification
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md bg-muted text-muted-foreground">
            Operations Release
          </span>
        </div>
      </button>
    </motion.div>
  );
}
