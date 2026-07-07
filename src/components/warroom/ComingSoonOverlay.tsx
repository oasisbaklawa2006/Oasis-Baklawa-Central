import { Lock, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  moduleName: string;
  /** Optional route to send the operator back to a working screen instead of a dead end. */
  returnTo?: string;
  returnLabel?: string;
}

export default function ComingSoonOverlay({ moduleName, returnTo, returnLabel }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
        <Lock size={28} className="text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">{moduleName}</h2>
      <span className="px-4 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-sm font-semibold border border-amber-500/20">
        Coming Soon in Phase 2
      </span>
      <p className="text-sm text-muted-foreground max-w-xs text-center">
        This module is under development and will be available in the next release.
      </p>
      {returnTo ? (
        <Link
          to={returnTo}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <ArrowLeft size={14} /> {returnLabel ?? "Back"}
        </Link>
      ) : null}
    </div>
  );
}
