export function normalizeProgrammaticTokenHashVerification<
  T extends { type: string; token_hash?: string },
>(params: T): T {
  if (params.token_hash && params.type === "magiclink") {
    return { ...params, type: "email" } as T;
  }
  return params;
}
