import { supabase } from "@/integrations/supabase/client";

const PORTAL_URL = import.meta.env.VITE_B2B_PORTAL_URL || "https://b2b.oasisbaklawa.com";
const CTA_FOOTER = `\n\nPlease login to your B2B Portal to track your 10-point artisan journey:\n${PORTAL_URL}`;
/**
 * Send a WhatsApp message via Click2API through the send-whatsapp Edge Function.
 * Provider delivery state is recorded by Core send-whatsapp authority — never invented here.
 * When companyId is supplied, the edge auto-logs to client_interactions for Point61 history.
 */
export const sendWhatsAppMessage = async (params: {
  to: string;
  message: string;
  companyId?: string;
  orderId?: string;
}) => {
  const { data, error } = await supabase.functions.invoke("send-whatsapp", {
    body: {
      to: params.to,
      message: params.message,
      company_id: params.companyId || null,
      order_id: params.orderId || null,
    },
  });

  if (error) {
    console.error("[WhatsApp] Send failed:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, data };
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
