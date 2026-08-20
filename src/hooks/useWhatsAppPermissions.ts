import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const WHATSAPP_PERMISSIONS = [
  "wa.intake.read",
  "wa.intake.triage",
  "wa.intake.assign",
  "wa.intake.close",
  "wa.draft.manage",
  "wa.draft.promote",
  "wa.reply.send",
  "wa.disclosure.authorize",
] as const;

export type WhatsAppPermission = (typeof WHATSAPP_PERMISSIONS)[number];

export function normalizeWhatsAppPermissions(value: unknown): Set<WhatsAppPermission> {
  if (!Array.isArray(value)) return new Set();
  const allowed = new Set<string>(WHATSAPP_PERMISSIONS);
  return new Set(
    value.filter((entry): entry is WhatsAppPermission => typeof entry === "string" && allowed.has(entry)),
  );
}

export function useWhatsAppPermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Set<WhatsAppPermission>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setPermissions(new Set());
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("get_my_whatsapp_permissions");
      if (rpcError) throw rpcError;
      setPermissions(normalizeWhatsAppPermissions(data));
    } catch (caught) {
      setPermissions(new Set());
      setError(caught instanceof Error ? caught.message : "WhatsApp authority check failed");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(
    () => ({ permissions, loading, error, has: (permission: WhatsAppPermission) => permissions.has(permission), refresh }),
    [error, loading, permissions, refresh],
  );
}
