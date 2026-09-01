import { verifyHmac } from "./razorpay-core.mjs";
// Dependencies are explicit for offline tests. The HTTP route supplies only real server adapters.
export async function processWebhook(
  raw,
  signature,
  { secret, findAttempt, reconcile },
) {
  if (!secret) return 503;
  if (!verifyHmac(raw, signature, secret)) return 401;
  let event;
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    return 400;
  }
  if (
    !["payment.captured", "payment.authorized", "order.paid"].includes(
      event?.event,
    )
  )
    return 200;
  const entity = event.payload?.payment?.entity;
  if (
    !entity ||
    !/^pay_[A-Za-z0-9]+$/.test(entity.id) ||
    !/^order_[A-Za-z0-9]+$/.test(entity.order_id)
  )
    return 400;
  try {
    const attempt = await findAttempt(entity.order_id);
    if (!attempt) return 200;
    await reconcile(attempt, entity.id);
    return 200;
  } catch {
    return 503;
  }
}
