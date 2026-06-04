import type {
  ComparisonLineView,
  SalesOrderDraftBundle,
  SalesOrderDraftComparisonView,
} from "./types";

function excerpt(text: string, max = 400): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export function buildSalesOrderDraftComparisonView(
  bundle: SalesOrderDraftBundle,
): SalesOrderDraftComparisonView {
  const { draft, lines } = bundle;
  const aiLines = draft.ai_draft_snapshot.lineItems ?? [];

  const comparisonLines: ComparisonLineView[] = lines.map((line) => {
    const aiLine = aiLines.find((item) => item.lineIndex === line.line_index);
    const aiQty = aiLine?.normalizedQuantity ?? aiLine?.rawQuantity ?? null;
    const aiUnit = aiLine?.normalizedUnit ?? aiLine?.rawUnit ?? null;
    const operatorQty = line.operator_quantity;
    const operatorUnit = line.normalized_unit ?? line.raw_unit;
    const changed =
      aiQty !== operatorQty ||
      (aiLine?.productName ?? line.product_name) !== line.product_name;

    return {
      lineIndex: line.line_index,
      originalTextSpan: line.original_text_span,
      aiProductName: aiLine?.productName ?? line.product_name,
      aiQuantity: aiQty,
      aiUnit,
      operatorProductName: line.product_name,
      operatorQuantity: operatorQty,
      operatorUnit,
      changed,
    };
  });

  const clientName = draft.company_name ?? "Unknown client";
  const aiSummary = `${clientName} · ${aiLines.length} line(s) · readiness ${draft.readiness_overall_score}%`;
  const operatorSummary = `${clientName} · ${lines.length} line(s) · operator-adjusted quantities`;

  return {
    originalWhatsAppExcerpt: excerpt(draft.original_whatsapp_text),
    aiDraftSummary: aiSummary,
    operatorFinalSummary: operatorSummary,
    lines: comparisonLines,
  };
}
