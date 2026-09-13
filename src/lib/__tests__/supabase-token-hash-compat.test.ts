import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/supabase-token-hash-compat.ts", "utf8");

describe("supabase token-hash compatibility shim", () => {
  it("only normalizes magiclink token_hash verification type", () => {
    expect(source).toContain("normalizeProgrammaticTokenHashVerification");
    expect(source).not.toContain("verifyTokenHashThenClaimApprovedB2bIdentity");
    expect(source).not.toContain("claimApprovedB2bIdentity");
  });
});
