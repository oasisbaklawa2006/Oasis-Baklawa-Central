export type Click2ApiAuthSource = "header" | "query";

function constantTimeEqual(received: string | null, expected: string | undefined): boolean {
  if (!received || !expected || received.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < received.length; index += 1) {
    difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

/** Click2API carries the configured shared token in the callback URL's `echo` parameter. */
export function authenticateClick2ApiWebhook(
  request: Request,
  expectedHeaderSecret: string | undefined,
  expectedQueryToken: string | undefined = expectedHeaderSecret,
): { authenticated: boolean; source: Click2ApiAuthSource | null } {
  const headerToken = request.headers.get("x-webhook-secret") ?? request.headers.get("x-click2api-signature");
  if (constantTimeEqual(headerToken, expectedHeaderSecret)) return { authenticated: true, source: "header" };

  const queryToken = new URL(request.url).searchParams.get("echo");
  if (constantTimeEqual(queryToken, expectedQueryToken)) return { authenticated: true, source: "query" };

  return { authenticated: false, source: null };
}

export function matchesWebhookToken(received: string | null, expected: string | undefined): boolean {
  return constantTimeEqual(received, expected);
}
