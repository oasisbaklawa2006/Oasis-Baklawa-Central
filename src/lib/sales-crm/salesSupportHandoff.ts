import { customerAppClient } from "@/lib/customerApp/customerAppClient";

/** Governed sales → support handoff via Core RPC (same contract as buyer order support). */
export async function submitSalesSupportTicket(params: {
  orderId: string;
  issueType: string;
  description: string;
}): Promise<string> {
  const trimmedDescription = params.description.trim();
  if (!params.orderId || !params.issueType || trimmedDescription.length < 8) {
    throw new Error("Order, issue type, and a description of at least 8 characters are required.");
  }
  return customerAppClient.submitTicket(
    params.orderId,
    params.issueType,
    trimmedDescription,
  );
}
