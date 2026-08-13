import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type WhatsAppClarificationSummary =
  Database["public"]["Functions"]["get_whatsapp_clarification_summary"]["Returns"][number];

export async function fetchWhatsAppClarificationSummary(): Promise<WhatsAppClarificationSummary | null> {
  const { data, error } = await supabase.rpc("get_whatsapp_clarification_summary");
  if (error) throw error;
  return data?.[0] ?? null;
}
