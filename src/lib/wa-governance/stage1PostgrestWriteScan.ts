import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

/** Paths covered by the Stage-1 PostgREST write guard (must match evidence pack). */
export const INBOX_POSTGREST_WRITE_SCAN_ROOTS = [
  "src/components/WhatsAppInbox.tsx",
  "src/components/whatsapp",
  "src/lib/wa-governance",
] as const;

export const FORBIDDEN_POSTGREST_WRITE_METHODS = [
  "insert",
  "update",
  "delete",
  "upsert",
  "rpc",
] as const;

export type ForbiddenPostgrestWriteHit = {
  method: (typeof FORBIDDEN_POSTGREST_WRITE_METHODS)[number];
  line: number;
  column: number;
};

export type OrderTableMutationHit = {
  method: string;
  table: string;
  line: number;
  column: number;
};

const FORBIDDEN_METHOD_SET = new Set<string>(FORBIDDEN_POSTGREST_WRITE_METHODS);
const PROTECTED_WHATSAPP_COMMERCIAL_TABLES = new Set([
  "orders",
  "order_items",
  "companies",
  "customers",
]);

function scriptKindForFile(fileName: string): ts.ScriptKind {
  return fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function getFromTableForMutationCall(call: ts.CallExpression): string | null {
  const expr = call.expression;
  if (!ts.isPropertyAccessExpression(expr)) return null;

  let base: ts.Expression = expr.expression;
  if (ts.isPropertyAccessExpression(base)) {
    base = base.expression;
  }

  if (!ts.isCallExpression(base)) return null;

  const fromAccess = base.expression;
  if (!ts.isPropertyAccessExpression(fromAccess) || fromAccess.name.text !== "from") {
    return null;
  }

  return readStringLiteral(base.arguments[0]);
}

function readStringLiteral(node: ts.Expression | undefined): string | null {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

function forbiddenMethodFromCall(call: ts.CallExpression): string | null {
  const expr = call.expression;
  if (!ts.isPropertyAccessExpression(expr)) return null;
  const method = expr.name.text;
  return FORBIDDEN_METHOD_SET.has(method) ? method : null;
}

/**
 * TypeScript AST scan for forbidden PostgREST client writes:
 * `.insert(`, `.update(`, `.upsert(`, `.delete(`, `.rpc(`.
 */
export function scanForbiddenPostgrestWrites(
  sourceText: string,
  fileName = "scan.ts",
): ForbiddenPostgrestWriteHit[] {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForFile(fileName),
  );
  const hits: ForbiddenPostgrestWriteHit[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const method = forbiddenMethodFromCall(node);
      if (method != null) {
        const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
        hits.push({
          method: method as ForbiddenPostgrestWriteHit["method"],
          line: line + 1,
          column: character + 1,
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return hits;
}

/**
 * Detects `from("orders").insert|update|upsert|delete` mutation chains via AST.
 */
export function scanOrderTableMutations(
  sourceText: string,
  fileName = "scan.ts",
): OrderTableMutationHit[] {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForFile(fileName),
  );
  const hits: OrderTableMutationHit[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const method = forbiddenMethodFromCall(node);
      if (method != null && method !== "rpc") {
        const table = getFromTableForMutationCall(node);
        if (table === "orders") {
          const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
          hits.push({ method, table, line: line + 1, column: character + 1 });
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return hits;
}

/** Detect direct mutations of commercial tables forbidden to WhatsApp paths. */
export function scanProtectedWhatsappCommercialMutations(
  sourceText: string,
  fileName = "scan.ts",
): OrderTableMutationHit[] {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForFile(fileName),
  );
  const hits: OrderTableMutationHit[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const method = forbiddenMethodFromCall(node);
      if (method != null && method !== "rpc") {
        const table = getFromTableForMutationCall(node);
        if (table != null && PROTECTED_WHATSAPP_COMMERCIAL_TABLES.has(table)) {
          const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
          hits.push({ method, table, line: line + 1, column: character + 1 });
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return hits;
}

export function collectInboxPostgrestWriteScanFiles(repoRoot: string): string[] {
  const files = new Set<string>();

  for (const root of INBOX_POSTGREST_WRITE_SCAN_ROOTS) {
    if (root.endsWith(".tsx") || root.endsWith(".ts")) {
      files.add(root);
      continue;
    }

    const abs = join(repoRoot, root);
    for (const file of collectSourceFiles(repoRoot, abs)) {
      if (file.includes("/tests/") || file.includes("/__tests__/")) continue;
      files.add(file);
    }
  }

  return [...files].sort();
}

function collectSourceFiles(repoRoot: string, dir: string): string[] {
  const out: string[] = [];

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...collectSourceFiles(repoRoot, full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(relative(repoRoot, full));
    }
  }

  return out;
}

export function readRepoSource(repoRoot: string, pathFromRoot: string): string {
  return readFileSync(join(repoRoot, pathFromRoot), "utf8");
}

export function scanRepoFileForForbiddenPostgrestWrites(
  repoRoot: string,
  pathFromRoot: string,
): ForbiddenPostgrestWriteHit[] {
  const source = readRepoSource(repoRoot, pathFromRoot);
  return scanForbiddenPostgrestWrites(source, pathFromRoot);
}
