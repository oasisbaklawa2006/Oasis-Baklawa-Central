import { supabase } from "@/integrations/supabase/client";

const PORTAL_URL = "https://id-preview--a2649760-8f34-4dcf-aaf4-ff101ea06ef6.lovable.app";
const CTA_FOOTER = `\n\n🔗 Login to your B2B Portal to track your 10-point artisan journey: ${PORTAL_URL}`;

/**
 * Send a WhatsApp message via Click2API through the send-whatsapp Edge Function.
 * Every message is auto-logged to client_interactions timeline.
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
    `🎉 Order Dispatched!`,
    ``,
    `Dear ${params.companyName},`,
    `Your order (${params.orderId.slice(0, 8).toUpperCase()}) has been dispatched from our facility.`,
    ``,
    trackingLine,
    invoiceLine,
    ``,
    `For any queries, contact your Sales Executive or reply to this message.`,
    `— Team Oasis Baklawa`,
    CTA_FOOTER,
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
    `📦 Dispatch Notification`,
    ``,
    `Order ${params.orderId.slice(0, 8).toUpperCase()} for ${params.companyName} has been dispatched.`,
    `Order Value: ₹${params.orderValue.toLocaleString("en-IN")}`,
    ``,
    `Please follow up with the client for delivery confirmation.`,
  ].join("\n");

  return sendWhatsAppMessage({
    to: params.execPhone,
    message,
  });
};
