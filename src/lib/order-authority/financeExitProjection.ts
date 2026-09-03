import { getFinanceExitFacts, type FinanceExitFacts } from "@/lib/order-authority/financeExitAuthorityClient";
import { getFinalPaymentPiFacts, type FinalPaymentPiFacts } from "@/lib/order-authority/finalPaymentPiAuthorityClient";

export function financeExitStage(
  facts: FinanceExitFacts | null,
  finalPaymentPi: FinalPaymentPiFacts | null,
): string {
  if (!facts) return "Select an order";
  if (facts.dispatchProofId) return "Gate exit recorded — dispatch handoff complete";
  if (facts.dispatchCleared) return "Finance Dispatch Clearance granted";
  if (facts.finalInvoiceId && facts.ewayEvidenceId) return "Ready for Dispatch Clearance decision";
  if (facts.finalInvoiceId) return "E-way decision required";
  if (finalPaymentPi?.available && finalPaymentPi.settled === true) {
    return "Final payment settled — final invoice required";
  }
  if (finalPaymentPi?.available) return "Final-payment PI revision issued — settlement pending";
  if (facts.financeDplReceiptId) return "Final-payment PI revision required";
  return "Submitted DPL receipt required";
}

/** Finance Exit facts are primary; PI projection failure must not discard them. */
export async function loadGovernedFinanceExitProjection(orderId: string): Promise<{
  facts: FinanceExitFacts;
  finalPaymentPi: FinalPaymentPiFacts | null;
}> {
  const facts = await getFinanceExitFacts(orderId);
  try {
    const finalPaymentPi = await getFinalPaymentPiFacts(orderId);
    return { facts, finalPaymentPi };
  } catch {
    return { facts, finalPaymentPi: null };
  }
}
