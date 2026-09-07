import ts from "typescript";

/** Finance legacy surfaces must not mutate orders directly — Core RPC only. */
export const FINANCE_FORBIDDEN_ORDERS_UPDATE_FIELDS = [
  'payment_status:"awaiting_advance"',
  "payment_status:'awaiting_advance'",
  'status:"awaiting_final_payment"',
  "status:'awaiting_final_payment'",
  'sales_order_value:',
] as const;

export type OrdersTableMutationHit = {
  line: number;
  column: number;
};

function scriptKindForFile(fileName: string): ts.ScriptKind {
  return fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function readStringLiteral(node: ts.Expression | undefined): string | null {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (ts.isParenthesizedExpression(current) || ts.isAwaitExpression(current)) {
    current = current.expression;
  }
  return current;
}

function isFromOrdersCall(call: ts.CallExpression): boolean {
  const access = call.expression;
  if (!ts.isPropertyAccessExpression(access) || access.name.text !== "from") {
    return false;
  }
  return readStringLiteral(call.arguments[0]) === "orders";
}

function isOrdersUpdateCall(call: ts.CallExpression): boolean {
  const access = call.expression;
  return ts.isPropertyAccessExpression(access) && access.name.text === "update";
}

/**
 * Whether an expression resolves to a Supabase query builder rooted at
 * `.from("orders")`, including simple identifier aliases assigned from that origin.
 */
function expressionTracesToOrdersOrigin(
  expression: ts.Expression,
  ordersQueryAliases: ReadonlyMap<string, true>,
): boolean {
  const expr = unwrapExpression(expression);

  if (ts.isIdentifier(expr)) {
    return ordersQueryAliases.has(expr.text);
  }

  if (ts.isCallExpression(expr)) {
    if (isFromOrdersCall(expr)) return true;
    const callee = expr.expression;
    if (ts.isPropertyAccessExpression(callee)) {
      return expressionTracesToOrdersOrigin(callee.expression, ordersQueryAliases);
    }
  }

  if (ts.isPropertyAccessExpression(expr)) {
    return expressionTracesToOrdersOrigin(expr.expression, ordersQueryAliases);
  }

  return false;
}

function collectOrdersQueryAliases(
  sourceFile: ts.SourceFile,
): Map<string, true> {
  const aliases = new Map<string, true>();

  const bindIdentifier = (name: ts.Identifier, initializer: ts.Expression): void => {
    if (expressionTracesToOrdersOrigin(initializer, aliases)) {
      aliases.set(name.text, true);
    }
  };

  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      bindIdentifier(node.name, node.initializer);
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      bindIdentifier(node.left, node.right);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  // Propagate simple alias chains: `const b = a` where `a` already aliases orders.
  let changed = true;
  while (changed) {
    changed = false;
    const propagate = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const expr = unwrapExpression(node.initializer);
        if (ts.isIdentifier(expr) && aliases.has(expr.text) && !aliases.has(node.name.text)) {
          aliases.set(node.name.text, true);
          changed = true;
        }
      }
      ts.forEachChild(node, propagate);
    };
    propagate(sourceFile);
  }

  return aliases;
}

/**
 * AST scan for prohibited direct `orders` table `.update(...)` mutations.
 * Detects chained calls and simple query-builder identifier aliases.
 */
export function scanOrdersTableUpdateMutations(
  sourceText: string,
  fileName = "finance-surface.ts",
): OrdersTableMutationHit[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForFile(fileName),
  );
  const aliases = collectOrdersQueryAliases(sourceFile);
  const hits: OrdersTableMutationHit[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isOrdersUpdateCall(node)) {
      const access = node.expression;
      if (ts.isPropertyAccessExpression(access)) {
        const receiver = unwrapExpression(access.expression);
        if (expressionTracesToOrdersOrigin(receiver, aliases)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          hits.push({ line: line + 1, column: character + 1 });
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return hits;
}

/** Whether source contains any direct `orders` table `.update(...)` mutation. */
export function hasDirectOrdersTableMutation(source: string, fileName = "finance-surface.ts"): boolean {
  return scanOrdersTableUpdateMutations(source, fileName).length > 0;
}

/**
 * Normalizes TypeScript source for deterministic forbidden-field matching in tests.
 * Strips comments and collapses whitespace.
 */
export function normalizeSourceForAuthorityGuard(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\s+/g, "");
}

export function hasForbiddenOrdersShadowMutation(source: string, fileName = "finance-surface.ts"): boolean {
  if (!hasDirectOrdersTableMutation(source, fileName)) return false;
  const normalized = normalizeSourceForAuthorityGuard(source);
  return FINANCE_FORBIDDEN_ORDERS_UPDATE_FIELDS.some((field) => normalized.includes(field));
}
