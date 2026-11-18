import { supabase } from "@/integrations/supabase/client";
import { classifyWhatsAppInvocationError, classifyWhatsAppSendResult, type WhatsAppSendResult } from "@/lib/wa-governance/whatsappSendResult";

const PORTAL_URL = import.meta.env.VITE_B2B_PORTAL_URL || "https://b2b.oasisbaklawa.com";
const CTA_FOOTER = `\n\nPlease login to your B2B Portal to track your 10-point artisan journey:\n${PORTAL_URL}`;
/**
 * Send a WhatsApp message via Click2API through the send-whatsapp Edge Function.
 * Every message is auto-logged to client_interactions timeline.
 */
export const sendWhatsAppMessage = async (params: {
  to: string;
  message: string;
  companyId?: string;
  orderId?: string;
}): Promise<WhatsAppSendResult> => {
  try {
    const { data, error } = await supabase.functions.invoke("send-whatsapp", {
      body: {
        to: params.to,
        message: params.message,
        company_id: params.companyId || null,
        order_id: params.orderId || null,
      },
    });

    if (error) {
      const response = (error as { context?: unknown }).context;
      if (response instanceof Response) {
        try {
          const result = classifyWhatsAppSendResult(await response.clone().json());
          if (!result.success && !result.acceptanceUnknown) return result;
        } catch {
          // An unreadable error response cannot establish provider rejection.
        }
      }
      console.warn("[WhatsApp] Invocation failed; delivery acceptance is unknown.");
      return await classifyWhatsAppInvocationError(error);
    }

    return classifyWhatsAppSendResult(data);
  } catch (error: unknown) {
    console.warn("[WhatsApp] Invocation interrupted; provider acceptance unconfirmed.");
    return await classifyWhatsAppInvocationError(error);
  }
};

/**
 * Send dispatch notification to client via WhatsApp.
 */
export const sendDispatchAlert = async (params: {
  phone: string;
  companyId: string;
  companyName: string;
  orderId: string;
  trackingNumber?: string;
  invoiceUrl?: string;
}) => {
  const trackingLine = params.trackingNumber
    ? `Track your shipment: ${params.trackingNumber}`
    : "Tracking details will be shared shortly.";

  const invoiceLine = params.invoiceUrl
    ? `Download your invoice: ${params.invoiceUrl}`
    : "";

  const message = [
    `Oasis Operations has dispatched your order.`,
    ``,
    `Order Reference: ${params.orderId.slice(0, 8).toUpperCase()}`,
    ``,
    trackingLine,
    invoiceLine,
    ``,
    `For any queries, please contact your Sales Executive or reply to this message.`,
    ``,
    `— Oasis Operations`,
  ]
    .filter(Boolean)
    .join("\n");

  return sendWhatsAppMessage({
    to: params.phone,
    message,
    companyId: params.companyId,
    orderId: params.orderId,
  });
};

/**
 * Send dispatch summary to the assigned Sales Executive.
 */
export const sendSalesExecDispatchNotification = async (params: {
  execPhone: string;
  companyName: string;
  orderId: string;
  orderValue: number;
}) => {
  const message = [
    `Dispatch Notification`,
    ``,
    `Order ${params.orderId.slice(0, 8).toUpperCase()} for ${params.companyName} has been dispatched.`,
    `Order Value: Rs. ${params.orderValue.toLocaleString("en-IN")}`,
    ``,
    `Please follow up with the client for delivery confirmation.`,
  ].join("\n");

  return sendWhatsAppMessage({
    to: params.execPhone,
    message,
  });
};
