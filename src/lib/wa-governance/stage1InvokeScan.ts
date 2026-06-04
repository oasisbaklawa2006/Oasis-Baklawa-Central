import ts from "typescript";

export const WHATSAPP_INBOX_INVOKE_SCAN_FILE = "src/components/WhatsAppInbox.tsx" as const;

export const ALLOWED_WHATSAPP_INBOX_INVOKE_SLUGS = [
  "whatsapp-classify-intent",
  "whatsapp-operator-reply",
  "whatsapp-route-packet",
] as const;

export const ALLOWED_WA_GOVERNANCE_FETCH_INVOKE_SLUGS = ["whatsapp-identify-sender"] as const;

/** Per-file literal slug allowlist for inbox-tree invoke guard tests. */
export const INBOX_TREE_INVOKE_ALLOWLIST_BY_FILE: Readonly<Record<string, readonly string[]>> = {
  [WHATSAPP_INBOX_INVOKE_SCAN_FILE]: ALLOWED_WHATSAPP_INBOX_INVOKE_SLUGS,
  "src/lib/wa-governance/fetchSenderIdentity.ts": ALLOWED_WA_GOVERNANCE_FETCH_INVOKE_SLUGS,
};

export type FunctionsInvokeDynamicReason =
  | "variable"
  | "template"
  | "concat"
  | "missing"
  | "non_literal";

export type FunctionsInvokeCallSite =
  | {
      kind: "literal";
      slug: string;
      line: number;
      column: number;
    }
  | {
      kind: "dynamic";
      reason: FunctionsInvokeDynamicReason;
      line: number;
      column: number;
    };

/** @deprecated Prefer FunctionsInvokeCallSite */
export type FunctionsInvokeHit = {
  slug: string;
  line: number;
  column: number;
};

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
}

function isFunctionsInvokeCallee(expression: ts.Expression): boolean {
  const unwrapped = unwrapExpression(expression);
  if (!ts.isPropertyAccessExpression(unwrapped)) return false;
  if (unwrapped.name.text !== "invoke") return false;

  const functionsAccess = unwrapExpression(unwrapped.expression);
  return ts.isPropertyAccessExpression(functionsAccess) && functionsAccess.name.text === "functions";
}

function classifyInvokeSlugArgument(
  argument: ts.Expression | undefined,
): Pick<FunctionsInvokeCallSite, "kind"> & ({ kind: "literal"; slug: string } | { kind: "dynamic"; reason: FunctionsInvokeDynamicReason }) {
  if (argument == null) {
    return { kind: "dynamic", reason: "missing" };
  }

  const unwrapped = unwrapExpression(argument);

  if (ts.isStringLiteral(unwrapped)) {
    return { kind: "literal", slug: unwrapped.text };
  }

  if (ts.isNoSubstitutionTemplateLiteral(unwrapped) || ts.isTemplateExpression(unwrapped)) {
    return { kind: "dynamic", reason: "template" };
  }

  if (ts.isBinaryExpression(unwrapped) && unwrapped.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return { kind: "dynamic", reason: "concat" };
  }

  if (
    ts.isIdentifier(unwrapped) ||
    ts.isPropertyAccessExpression(unwrapped) ||
    ts.isElementAccessExpression(unwrapped) ||
    ts.isCallExpression(unwrapped)
  ) {
    return { kind: "dynamic", reason: "variable" };
  }

  return { kind: "dynamic", reason: "non_literal" };
}

function callSiteFromInvokeCall(
  source: ts.SourceFile,
  call: ts.CallExpression,
): FunctionsInvokeCallSite {
  const { line, character } = source.getLineAndCharacterOfPosition(call.getStart(source));
  const classified = classifyInvokeSlugArgument(call.arguments[0]);

  if (classified.kind === "literal") {
    return {
      kind: "literal",
      slug: classified.slug,
      line: line + 1,
      column: character + 1,
    };
  }

  return {
    kind: "dynamic",
    reason: classified.reason,
    line: line + 1,
    column: character + 1,
  };
}

function collectFunctionsInvokeCalls(sourceFile: ts.SourceFile): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isFunctionsInvokeCallee(node.expression)) {
      calls.push(node);
    }

    if (ts.isOptionalChain(node)) {
      const inner = node.expression;
      if (ts.isCallExpression(inner) && isFunctionsInvokeCallee(inner.expression)) {
        calls.push(inner);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return calls;
}

function createSourceFile(sourceText: string, fileName: string): ts.SourceFile {
  return ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

/**
 * TypeScript AST scan for `*.functions.invoke(...)` / `*.functions?.invoke(...)` call sites.
 * Dynamic/non-literal slug arguments are reported explicitly as unsafe.
 */
export function scanFunctionsInvokeCalls(
  sourceText: string,
  fileName = "scan.ts",
): FunctionsInvokeCallSite[] {
  const source = createSourceFile(sourceText, fileName);
  return collectFunctionsInvokeCalls(source).map((call) => callSiteFromInvokeCall(source, call));
}

/**
 * Literal string slugs only. Dynamic invoke sites are excluded (use scanFunctionsInvokeCalls).
 */
export function scanFunctionsInvokeSlugs(sourceText: string, fileName = "scan.ts"): FunctionsInvokeHit[] {
  return scanFunctionsInvokeCalls(sourceText, fileName)
    .filter((site): site is Extract<FunctionsInvokeCallSite, { kind: "literal" }> => site.kind === "literal")
    .map(({ slug, line, column }) => ({ slug, line, column }));
}

export function scanDynamicFunctionsInvokes(
  sourceText: string,
  fileName = "scan.ts",
): Extract<FunctionsInvokeCallSite, { kind: "dynamic" }>[] {
  return scanFunctionsInvokeCalls(sourceText, fileName).filter(
    (site): site is Extract<FunctionsInvokeCallSite, { kind: "dynamic" }> => site.kind === "dynamic",
  );
}

export function countFunctionsInvokeSlug(
  sourceText: string,
  slug: string,
  fileName = "scan.ts",
): number {
  return scanFunctionsInvokeSlugs(sourceText, fileName).filter((hit) => hit.slug === slug).length;
}

export function findInboxTreeInvokeViolations(
  files: string[],
  readSource: (pathFromRoot: string) => string,
  allowlistByFile: Readonly<Record<string, readonly string[]>> = INBOX_TREE_INVOKE_ALLOWLIST_BY_FILE,
): string[] {
  const violations: string[] = [];

  for (const file of files) {
    const sites = scanFunctionsInvokeCalls(readSource(file), file);
    if (sites.length === 0) continue;

    const allowed = new Set(allowlistByFile[file] ?? []);

    if (allowed.size === 0) {
      violations.push(`${file}:unexpected-invoke@${sites.map((site) => site.line).join(",")}`);
      continue;
    }

    for (const site of sites) {
      if (site.kind === "dynamic") {
        violations.push(`${file}:dynamic@${site.line}:${site.reason}`);
        continue;
      }
      if (!allowed.has(site.slug)) {
        violations.push(`${file}:unallowlisted@${site.line}:${site.slug}`);
      }
    }
  }

  return violations.sort();
}
