import { verifyHmac } from "./razorpay-core.mjs";
// Dependencies are explicit for offline tests. The HTTP route supplies only real server adapters.
export async function processWebhook(
  raw,
  signature,
  { secret, findAttempt, reconcile, eventId, recordEvent, reconcileRefund },
) {
  if (!secret) return 503;
  if (!verifyHmac(raw, signature, secret)) return 401;
  let event;
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    return 400;
  }
  const supported = [
    "payment.captured",
    "payment.authorized",
    "payment.failed",
    "refund.created",
    "refund.processed",
    "refund.failed",
  ];
  if (!supported.includes(event?.event)) return 200;
  const entity =
    event.payload?.payment?.entity ?? event.payload?.refund?.entity;
  // A failed checkout notification may not contain a payment entity. It is not
  // actionable until it can be reconciled, but must not cause provider retries.
  if (event.event === "payment.failed" && !entity) return 200;
  if (
    !entity ||
    (event.event.startsWith("refund.")
      ? !/^rfnd_[A-Za-z0-9]+$/.test(entity.id)
      : !/^pay_[A-Za-z0-9]+$/.test(entity.id))
  )
    return 400;
  try {
    if (eventId && recordEvent) {
      const inserted = await recordEvent(
        eventId,
        event.event,
        entity.order_id ?? null,
        event.event.startsWith("refund.")
          ? (entity.payment_id ?? null)
          : entity.id,
      );
      if (!inserted) return 200;
    }
    if (event.event.startsWith("refund.")) {
      if (!reconcileRefund) return 503;
      await reconcileRefund(
        entity.id,
        event.event === "refund.processed" ? "processed" : "failed",
      );
      return 200;
    }
    if (!/^order_[A-Za-z0-9]+$/.test(entity.order_id)) return 400;
    const attempt = await findAttempt(entity.order_id);
    if (!attempt) return 200;
    await reconcile(attempt, entity.id);
    return 200;
  } catch {
    return 503;
  }
}
