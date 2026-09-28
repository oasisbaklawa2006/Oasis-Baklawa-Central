import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// AUTH SPLIT — B2B Client Login vs Oasis Staff Login. The combined Login.tsx
// has been split into AuthEntry.tsx (/login, neutral selector) and
// BuyerLogin.tsx (/buyer/login, B2B authentication). The "Request B2B
// Access" CTA is required on both per the auth-split spec. Each surface may
// wire it up differently (a named handler, or an inline arrow) -- the
// contract this test enforces is that the CTA navigates straight to
// /buyer/access-request without first forcing OTP, not any particular
// binding style.

/** Finds the onClick expression immediately preceding the CTA's label text. */
function extractCtaOnClick(source: string, label: string) {
  const labelIndex = source.indexOf(label);
  expect(labelIndex).toBeGreaterThan(-1);
  const onClickStart = source.lastIndexOf("onClick={", labelIndex);
  expect(onClickStart).toBeGreaterThan(-1);
  const exprStart = onClickStart + "onClick={".length;
  const exprEnd = source.indexOf("}", exprStart);
  return source.slice(exprStart, exprEnd);
}

describe.each([
  ["AuthEntry", "src/pages/AuthEntry.tsx", "Request B2B Access"],
  ["BuyerLogin", "src/pages/BuyerLogin.tsx", "Request B2B Access"],
])("%s / Request B2B Access CTA", (_name, path, ctaLabel) => {
  const source = readFileSync(path, "utf8");

  it("never navigates to the deleted /register route", () => {
    expect(source).not.toContain('"/register"');
    expect(source).not.toContain("'/register'");
  });

  it("renders the CTA label", () => {
    expect(source).toContain(ctaLabel);
  });

  it("opens the governed pre-login B2B application directly without forcing OTP", () => {
    const onClickExpr = extractCtaOnClick(source, ctaLabel);
    const isNamedHandler = /^[A-Za-z_$][\w$]*$/.test(onClickExpr);
    const body = isNamedHandler
      ? (() => {
          const handlerStart = source.indexOf(`const ${onClickExpr} = `);
          expect(handlerStart).toBeGreaterThan(-1);
          const handler = source.slice(handlerStart);
          return handler.slice(0, handler.indexOf("};") + 2);
        })()
      : onClickExpr;
    expect(body).toContain('navigate("/buyer/access-request")');
    expect(body).not.toContain('setActiveTab("msg91")');
    expect(body).not.toContain("launchMsg91Widget()");
  });
});
