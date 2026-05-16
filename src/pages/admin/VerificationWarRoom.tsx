import { Link } from "react-router-dom";
import { Ghost, ArrowRight } from "lucide-react";

/**
 * VerificationWarRoom is retired.
 *
 * Shadow client triage has moved to CMD War Room → Shadow Leads tab,
 * which provides AI-verified SKU approval, multi-entity classification,
 * and the governance-gated activation flow (pending_approval → Client Governance).
 *
 * This route is kept active to avoid 404s on existing bookmarks or links.
 */
const VerificationWarRoom = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
      <Ghost size={28} className="text-muted-foreground" />
    </div>
    <div className="max-w-md">
      <h2 className="text-xl font-semibold text-foreground mb-2">
        Shadow Client Verification Has Moved
      </h2>
      <p className="text-sm text-muted-foreground leading-relaxed">
        WhatsApp lead triage and shadow client verification are now handled in{" "}
        <strong className="text-foreground">CMD War Room → Shadow Leads</strong>.
        Use the War Room to review leads, verify SKUs, and route new clients through
        the formal governance approval queue.
      </p>
    </div>
    <Link
      to="/admin/cmd-war-room"
      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
    >
      Go to CMD War Room <ArrowRight size={14} />
    </Link>
  </div>
);

export default VerificationWarRoom;
