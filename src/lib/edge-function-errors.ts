type EdgeFunctionErrorBody = {
  ok?: boolean;
  error?: string;
  reason?: string;
};

const GENERIC_INVOKE_ERRORS = new Set([
  "Edge Function returned a non-2xx status code",
  "Relay Error invoking the Edge Function",
  "Failed to send a request to the Edge Function",
]);

function readEdgeErrorField(body: EdgeFunctionErrorBody | null | undefined): string | null {
  const candidate = body?.error?.trim() || body?.reason?.trim();
  return candidate || null;
}

async function readResponseErrorBody(response: Response): Promise<string | null> {
  try {
    const clone = response.clone();
    const body = (await clone.json()) as EdgeFunctionErrorBody;
    return readEdgeErrorField(body);
  } catch {
    return null;
  }
}

/**
 * Extracts an ops-safe Edge Function error code from a Supabase functions.invoke result.
 * Prefers structured `{ ok:false, error }` payloads over generic invoke wrapper messages.
 */
export async function extractEdgeFunctionErrorCode(
  result: { data: unknown; error: unknown; response?: Response },
): Promise<string | null> {
  const data = result.data as EdgeFunctionErrorBody | null;
  if (data?.ok === false) {
    return readEdgeErrorField(data);
  }

  const response = result.response
    ?? (result.error as { context?: Response } | null | undefined)?.context;
  if (response instanceof Response) {
    const fromBody = await readResponseErrorBody(response);
    if (fromBody) return fromBody;
  }

  if (result.error instanceof Error) {
    const message = result.error.message.trim();
    if (message && !GENERIC_INVOKE_ERRORS.has(message)) {
      return message;
    }
  }

  return null;
}
