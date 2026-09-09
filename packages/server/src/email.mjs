import nodemailer from "nodemailer";

const EVENT_SUBJECTS = {
  "order.accepted": "Your FADEN order has been created",
  "payment.test_captured": "Your FADEN payment was successful",
  "design.published": "Your FADEN design is ready for review",
  "production.updated": "Your FADEN order has a production update",
  "manual_shipment.updated": "Your FADEN shipment has an update",
  "aftercare.submitted": "We received your FADEN aftercare request",
};

export function emailTemplate(eventType, payload, canonicalUrl) {
  const subject = EVENT_SUBJECTS[eventType];
  if (!subject || !canonicalUrl) return null;
  const orderId =
    typeof payload?.order_id === "string" ? payload.order_id : null;
  const href = orderId
    ? `${canonicalUrl.replace(/\/$/, "")}/orders/${encodeURIComponent(orderId)}`
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
  env = process.env,
}) {
  if (env.EMAIL_DISPATCH_ENABLED !== "true")
    throw new Error("Email dispatch is disabled.");
  if (typeof to !== "string" || !/^\S+@\S+\.\S+$/.test(to))
    throw new Error("Invalid recipient.");
  const template = emailTemplate(eventType, payload, env.NEXT_PUBLIC_APP_URL);
  if (!template) return { skipped: true };
  const from = env.SMTP_FROM || env.SMTP_USER;
  const result = await createSmtpTransport(env).sendMail({
    from,
    to,
    ...template,
  });
  return { skipped: false, messageId: result.messageId };
}
