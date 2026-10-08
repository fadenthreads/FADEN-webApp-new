import nodemailer from "nodemailer";

const EVENT_SUBJECTS = {
  "request.shared": "A customer shared a new request with your boutique",
  "outfit_request.submitted": "We received your FADEN request",
  "boutique.application.created": "A new boutique application needs review",
  "offer.sent": "You received a new FADEN quotation",
  "order.accepted": "Your FADEN order has been created",
  "order.cancelled": "A FADEN order was cancelled",
  "order.message_sent": "You have a new message about your FADEN order",
  "payment.test_captured": "Your FADEN payment was successful",
  "payment.refund_pending": "Your FADEN refund is being processed",
  "payment.refund_completed": "Your FADEN refund was completed",
  "payment.refund_failed": "Your FADEN refund needs attention",
  "design.published": "Your FADEN design is ready for review",
  "design.approved": "The customer approved the FADEN design",
  "design.changes_requested": "The customer requested design changes",
  "production.updated": "Your FADEN order has a production update",
  "appointment.preview_reserved": "Your FADEN measurement session is confirmed",
  "appointment.preview_cancelled":
    "Your FADEN measurement session was cancelled",
  "manual_shipment.updated": "Your FADEN shipment has an update",
  "aftercare.submitted": "We received your FADEN aftercare request",
  "aftercare.updated": "Your FADEN aftercare request has an update",
  "support.opened": "A new FADEN support request was opened",
  verification_submitted: "A boutique submitted verification details",
  verification_approved: "Your FADEN boutique was approved",
  verification_changes_requested:
    "FADEN needs changes to your boutique verification",
  verification_rejected: "Your FADEN boutique verification was not approved",
};

export function emailTemplate(eventType, payload, canonicalUrl) {
  const subject = EVENT_SUBJECTS[eventType];
  if (!subject || !canonicalUrl) return null;
  const orderId =
    typeof payload?.order_id === "string" ? payload.order_id : null;
  const base = canonicalUrl.replace(/\/$/, "");
  const shareId =
    typeof payload?.share_id === "string" ? payload.share_id : null;
  const offerId =
    typeof payload?.offer_id === "string" ? payload.offer_id : null;
  const href =
    eventType === "request.shared" && shareId
      ? `${base}/requests/${encodeURIComponent(shareId)}`
      : eventType === "offer.sent" && offerId
        ? `${base}/offers/${encodeURIComponent(offerId)}`
        : eventType === "order.message_sent" && orderId
          ? `${base}/orders/${encodeURIComponent(orderId)}/messages`
          : orderId
            ? `${base}/orders/${encodeURIComponent(orderId)}`
            : canonicalUrl;
  return {
    subject,
    text: `${subject}. View the details securely in FADEN: ${href}`,
    html: `<p>${subject}.</p><p><a href="${href}">View securely in FADEN</a></p>`,
  };
}

export function createSmtpTransport(env = process.env) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD)
    throw new Error("SMTP is not configured.");
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE === "true",
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
}

export async function sendTransactionalEmail({
  to,
  eventType,
  payload,
  canonicalUrl,
  env = process.env,
}) {
  if (env.EMAIL_DISPATCH_ENABLED !== "true")
    throw new Error("Email dispatch is disabled.");
  if (typeof to !== "string" || !/^\S+@\S+\.\S+$/.test(to))
    throw new Error("Invalid recipient.");
  const template = emailTemplate(
    eventType,
    payload,
    canonicalUrl || env.NEXT_PUBLIC_APP_URL,
  );
  if (!template) return { skipped: true };
  const from = env.SMTP_FROM || env.SMTP_USER;
  const result = await createSmtpTransport(env).sendMail({
    from,
    to,
    ...template,
  });
  return { skipped: false, messageId: result.messageId };
}
