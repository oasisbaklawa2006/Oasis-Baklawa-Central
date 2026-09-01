import WhatsAppInbox from "@/components/WhatsAppInbox";
import { OperatorInboxWorkspacePersistenceGate } from "@/components/whatsapp/OperatorInboxWorkspacePersistenceGate";

export default function OperatorInbox() {
  return (
    <OperatorInboxWorkspacePersistenceGate>
      <div className="h-screen">
        <WhatsAppInbox />
      </div>
    </OperatorInboxWorkspacePersistenceGate>
  );
}
