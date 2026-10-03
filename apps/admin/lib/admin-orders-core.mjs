const shipmentStatuses = new Set([
  "awaiting_arrangement",
  "booked",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "exception",
  "cancelled",
]);
export function parseOrderListParams(params) {
  return {
    search:
      typeof params.search === "string" && params.search.trim()
        ? params.search.trim().slice(0, 120)
        : null,
    queue: params.queue === "shipping" ? "shipping" : null,
    orderStatus:
      typeof params.order_status === "string" ? params.order_status : null,
    paymentStatus:
      typeof params.payment_status === "string" ? params.payment_status : null,
    shipmentStatus: shipmentStatuses.has(params.shipment_status)
      ? params.shipment_status
      : null,
    cursor: typeof params.cursor === "string" ? params.cursor : null,
    cursorId: typeof params.cursor_id === "string" ? params.cursor_id : null,
  };
}
export function validateOrderCommand(body) {
  if (
    !body ||
    typeof body !== "object" ||
    typeof body.action !== "string" ||
    typeof body.order_id !== "string"
  )
    return null;
  if (body.action === "claim" || body.action === "unclaim")
    return {
      action: body.action,
      orderId: body.order_id,
      expectedVersion: Number.isInteger(body.expected_version)
        ? body.expected_version
        : null,
    };
  if (body.action === "note" && typeof body.body === "string")
    return { action: body.action, orderId: body.order_id, body: body.body };
  if (body.action === "reveal_address" && typeof body.reason === "string")
    return { action: body.action, orderId: body.order_id, reason: body.reason };
  if (
    body.action === "support" &&
    typeof body.case_id === "string" &&
    [
      "open",
      "awaiting_customer",
      "awaiting_boutique",
      "resolved",
      "closed",
    ].includes(body.status) &&
    (typeof body.note === "string" || typeof body.note === "undefined")
  )
    return {
      action: body.action,
      orderId: body.order_id,
      caseId: body.case_id,
      status: body.status,
      note: body.note ?? null,
    };
  if (
    body.action === "shipment" &&
    shipmentStatuses.has(body.status) &&
    typeof body.carrier_name === "string" &&
    typeof body.tracking_number === "string" &&
    Number.isInteger(body.expected_version)
  )
    return {
      action: body.action,
      orderId: body.order_id,
      expectedVersion: body.expected_version,
      carrierName: body.carrier_name,
      trackingNumber: body.tracking_number,
      trackingUrl:
        typeof body.tracking_url === "string" ? body.tracking_url : null,
      status: body.status,
      adminNote: typeof body.admin_note === "string" ? body.admin_note : null,
      confirmDelivered: body.confirm_delivered === true,
    };
  return null;
}
