import { Lock } from "lucide-react";

interface Props {
  moduleName: string;
}

export default function ComingSoonOverlay({ moduleName }: Props) {
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
    </div>
  );
}
