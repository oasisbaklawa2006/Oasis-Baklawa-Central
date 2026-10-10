import { supabase } from "@/integrations/supabase/client";

type FunctionsInvoke = typeof supabase.functions.invoke;
type InvokeOptions = Parameters<FunctionsInvoke>[1];

let installed = false;

export function resolveMsg91SessionFunction(
  functionName: string,
  options?: InvokeOptions,
): string {
  if (functionName !== "msg91-otp") return functionName;

  const body = options?.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return functionName;

  const mode = (body as Record<string, unknown>).mode;
  return mode === "verify_widget" ? "msg91-session-bridge" : functionName;
}

/**
 * UAT #561 restoration adapter.
 *
 * Route only the pre-auth MSG91 provider-verification/session-handoff request
 * through the additive Core bridge. Legacy msg91-otp modes and every unrelated
 * Supabase Edge Function keep their original target.
 */
export function installMsg91SessionBridgeRouting() {
  if (installed) return;

  const originalInvoke = supabase.functions.invoke.bind(supabase.functions) as FunctionsInvoke;
  supabase.functions.invoke = ((functionName: string, options?: InvokeOptions) =>
    originalInvoke(resolveMsg91SessionFunction(functionName, options), options)) as FunctionsInvoke;

  installed = true;
}
