import ts from "typescript";

export const WHATSAPP_INBOX_INVOKE_SCAN_FILE = "src/components/WhatsAppInbox.tsx" as const;

export const ALLOWED_WHATSAPP_INBOX_INVOKE_SLUGS = [
  "whatsapp-classify-intent",
  "whatsapp-operator-reply",
  "whatsapp-route-packet",
] as const;

export type FunctionsInvokeHit = {
  slug: string;
  line: number;
  column: number;
};

function isFunctionsInvokeCallee(expression: ts.Expression): boolean {
  if (!ts.isPropertyAccessExpression(expression)) return false;
  if (expression.name.text !== "invoke") return false;
  const left = expression.expression;
  return ts.isPropertyAccessExpression(left) && left.name.text === "functions";
}

function readStringLiteral(node: ts.Expression | undefined): string | null {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

/**
 * TypeScript AST scan for `*.functions.invoke("slug", …)` call sites.
 */
export function scanFunctionsInvokeSlugs(sourceText: string, fileName = "scan.ts"): FunctionsInvokeHit[] {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const hits: FunctionsInvokeHit[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isFunctionsInvokeCallee(node.expression)) {
      const slug = readStringLiteral(node.arguments[0]);
      if (slug != null) {
        const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
        hits.push({ slug, line: line + 1, column: character + 1 });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return hits;
}

export function countFunctionsInvokeSlug(
  sourceText: string,
  slug: string,
  fileName = "scan.ts",
): number {
  return scanFunctionsInvokeSlugs(sourceText, fileName).filter((hit) => hit.slug === slug).length;
}
