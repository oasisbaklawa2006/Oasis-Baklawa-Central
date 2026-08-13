import { Loader2, ShieldX } from "lucide-react";
import { useWhatsAppPermissions, type WhatsAppPermission } from "@/hooks/useWhatsAppPermissions";

export function WhatsAppPermissionRoute({ permission, children }: { permission: WhatsAppPermission; children: React.ReactNode }) {
  const authority = useWhatsAppPermissions();

  if (authority.loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Checking WhatsApp authority" /></div>;
  }

  if (authority.error || !authority.has(permission)) {
    return (
      <div className="mx-auto mt-16 max-w-lg rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center" role="alert">
        <ShieldX className="mx-auto h-8 w-8 text-destructive" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold">WhatsApp access unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Core did not grant this identity <code>{permission}</code>. Ask an RBAC administrator to review the user’s active role and permission grant.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
