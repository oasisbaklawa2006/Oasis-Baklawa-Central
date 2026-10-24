import { ArrowLeft } from "lucide-react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import WhatsAppInbox from "@/components/WhatsAppInbox";
import { OperatorInboxWorkspacePersistenceGate } from "@/components/whatsapp/OperatorInboxWorkspacePersistenceGate";
import { WhatsAppWorkQueue } from "@/components/whatsapp/workQueue/WhatsAppWorkQueue";
import { useWhatsAppPermissions } from "@/hooks/useWhatsAppPermissions";

/**
 * /admin/operator-inbox and /admin/whatsapp.
 *
 * Default: the simple work queue (Needs Action first). The full conversation console is unchanged
 * and is reached with ?packet=<id> (from a task, or an existing deep link) or ?view=all, which is
 * limited to users who can assign or close. The role gate is a UI default; RLS and the Core RPCs
 * remain the enforcement.
 */
export default function OperatorInbox() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const wa = useWhatsAppPermissions();

  const packetParam = searchParams.get("packet")?.trim();
  const wantsAll = searchParams.get("view") === "all";
  const canViewAll = wa.has("wa.intake.assign") || wa.has("wa.intake.close");

  if (wantsAll && !packetParam && !wa.loading && !canViewAll) {
    return <Navigate to="/admin/operator-inbox" replace />;
  }

  if (packetParam || wantsAll) {
    return (
      <OperatorInboxWorkspacePersistenceGate>
        <div className="flex h-screen flex-col">
          <div className="flex h-10 shrink-0 items-center border-b border-gray-200 bg-white px-3">
            <button
              type="button"
              onClick={() => navigate("/admin/operator-inbox")}
              className="inline-flex items-center gap-1 rounded text-sm font-medium text-gray-800 outline-none hover:text-green-700 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
              data-back-to-work-queue
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back to work queue
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden [&>[role=main]]:!h-full">
            <WhatsAppInbox />
          </div>
        </div>
      </OperatorInboxWorkspacePersistenceGate>
    );
  }

  return (
    <div className="h-screen">
      <WhatsAppWorkQueue
        canViewAllConversations={canViewAll}
        onOpenAllConversations={() => navigate("/admin/operator-inbox?view=all")}
        onOpenConversation={(packetId) => navigate(`/admin/operator-inbox?packet=${encodeURIComponent(packetId)}`)}
      />
    </div>
  );
}
