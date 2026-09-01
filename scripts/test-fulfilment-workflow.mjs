import assert from "node:assert/strict";
import { testAftercare } from "./test-aftercare-workflow.mjs";
export async function testFulfilment({
  admin,
  owner,
  customer,
  other,
  order,
  b,
  page,
}) {
  let checks = 0;
  const ok = (v, m) => {
    assert.ok(v, m);
    checks++;
  };
  const saved = (
    await admin
      .from("order_design_reviews")
      .select()
      .eq("order_id", order.id)
      .order("revision", { ascending: false })
      .limit(1)
  ).data[0];
  async function post(
    who,
    body,
    port = 3000,
    origin = `http://localhost:${port}`,
  ) {
    const r = await fetch(`http://localhost:${port}/api/fulfilment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        ...(who ? { Cookie: who.cookie } : {}),
      },
      body: JSON.stringify({ orderId: order.id, confirmed: true, ...body }),
    });
    return { status: r.status, body: await r.json() };
  }
  const address = {
    recipient: "PRIVATE DELIVERY FIXTURE",
    phone: "+919876543210",
    line1: "42 Fictional Street",
    line2: "Test only",
    city: "Chennai",
    state: "Tamil Nadu",
    postal_code: "600001",
    country: "IN",
  };
  const save = {
    action: "address",
    revision: 0,
    details: address,
    commandId: crypto.randomUUID(),
  };
  const progress = (sequence, stage) => ({
    action: "progress",
    sequence,
    stage,
    note: "Fictional shipment milestone for isolated tests.",
    commandId: crypto.randomUUID(),
  });
  const read = async (table) => {
    const r = await customer.client
      .from(table)
      .select()
      .eq("order_id", order.id);
    assert.equal(r.error, null);
    return r.data;
  };
  try {
    ok((await post(null, save)).status === 401, "anonymous address denied");
    ok(
      (await post(customer, save, 3000, "https://other.example")).status ===
        403,
      "cross-origin writes denied",
    );
    ok(
      (await post(owner, save)).status === 409,
      "owner cannot author customer address",
    );
    ok(
      (await post(other, save)).status === 409,
      "other customer cannot author address",
    );
    ok(
      (await post(customer, { ...save, confirmed: false })).status === 400,
      "address sharing confirmation required",
    );
    ok(
      (
        await post(customer, {
          ...save,
          details: { ...address, postal_code: "12" },
        })
      ).status === 409,
      "invalid PIN rejected",
    );
    ok(
      (
        await post(customer, {
          ...save,
          details: { ...address, phone: "1234" },
        })
      ).status === 409,
      "invalid mobile rejected",
    );
    ok(
      (
        await post(customer, {
          ...save,
          details: { ...address, verification: "verified" },
        })
      ).status === 409,
      "extra verification field rejected",
    );
    ok(
      (await post(customer, { ...save, details: { ...address, line1: null } }))
        .status === 409,
      "non-string address rejected",
    );
    ok(
      (await post(customer, save)).status === 200,
      "customer confirms address",
    );
    ok(
      (await post(customer, save)).status === 200,
      "same address retry idempotent",
    );
    ok(
      (
        await post(customer, {
          ...save,
          details: { ...address, city: "Mumbai" },
        })
      ).status === 409,
      "command cannot change address",
    );
    ok(
      (await read("order_delivery_details"))[0].verification === "unverified",
      "address never claims verification",
    );
    const second = {
      ...save,
      revision: 1,
      details: { ...address, line2: "Updated test unit" },
      commandId: crypto.randomUUID(),
    };
    ok(
      (await post(customer, second)).status === 200,
      "customer edits before packing",
    );
    ok(
      (await post(customer, { ...save, commandId: crypto.randomUUID() }))
        .status === 409,
      "stale revision rejected",
    );
    ok(
      (
        await other.client
          .from("order_delivery_details")
          .select()
          .eq("order_id", order.id)
      ).data.length === 0,
      "address invisible to unrelated customer",
    );
    ok(
      (
        await owner.client
          .from("order_delivery_details")
          .select()
          .eq("order_id", order.id)
      ).data.length === 1,
      "permitted boutique can read address",
    );
    ok(
      !!(
        await customer.client
          .from("order_delivery_details")
          .update({ verification: "verified" })
          .eq("order_id", order.id)
      ).error,
      "direct address forgery blocked",
    );
    ok(
      (
        await page(3000, `/orders/${order.id}/complete`, customer)
      ).text.includes("not ready"),
      "completion gated before receipt",
    );
    ok(
      (await post(owner, progress(0, 1), 3001)).status === 409,
      "production prerequisite enforced",
    );
    assert.equal(
      (
        await admin.from("order_production_updates").insert({
          id: crypto.randomUUID(),
          order_id: order.id,
          sequence: 1,
          stage: 5,
          note: "Isolated fixture for shipment prerequisites.",
        })
      ).error,
      null,
    );
    await admin
      .from("order_design_reviews")
      .update({ status: "pending", reviewed_at: null, feedback: "" })
      .eq("id", saved.id);
    ok(
      (await post(owner, progress(0, 1), 3001)).status === 409,
      "design approval prerequisite enforced",
    );
    await admin
      .from("order_design_reviews")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        feedback: "",
      })
      .eq("id", saved.id);
    ok(
      (await post(customer, progress(0, 1))).status === 409,
      "customer cannot record shipment milestone",
    );
    ok(
      (await post(owner, progress(0, 3), 3001)).status === 409,
      "first milestone cannot skip packing",
    );
    const packed = progress(0, 1);
    ok(
      (await post(owner, packed, 3001)).status === 200,
      "owner rehearses packing",
    );
    ok(
      (await post(owner, packed, 3001)).status === 200,
      "shipment retry idempotent",
    );
    ok(
      (
        await post(
          owner,
          { ...packed, note: "Changed note on reused command" },
          3001,
        )
      ).status === 409,
      "shipment command immutable",
    );
    ok(
      (
        await post(customer, {
          ...second,
          revision: 2,
          commandId: crypto.randomUUID(),
        })
      ).status === 409,
      "address locked after packing",
    );
    ok(
      (await post(customer, { action: "confirm", eventId: packed.commandId }))
        .status === 409,
      "early delivery confirmation denied",
    );
    ok(
      (await post(owner, progress(1, 4), 3001)).status === 409,
      "shipment milestone skipping denied",
    );
    const race = await Promise.all([
      post(owner, progress(1, 2), 3001),
      post(owner, progress(1, 2), 3001),
    ]);
    ok(
      race.filter((r) => r.status === 200).length === 1,
      "concurrent shipment updates have one winner",
    );
    ok(
      (await post(owner, progress(2, 1), 3001)).status === 409,
      "shipment cannot go backwards",
    );
    for (const [seq, stage] of [
      [2, 3],
      [3, 4],
      [4, 5],
    ])
      assert.equal((await post(owner, progress(seq, stage), 3001)).status, 200);
    let events = (await read("order_shipment_events")).sort(
      (a, b) => b.sequence - a.sequence,
    );
    const final = events[0];
    ok(
      events.length === 5 &&
        events.every((e) => e.mode === "rehearsal" && e.address_revision === 2),
      "ordered history pins confirmed address revision",
    );
    ok(
      (await post(owner, { action: "confirm", eventId: final.id }, 3001))
        .status === 409,
      "owner cannot confirm customer delivery",
    );
    ok(
      (await post(customer, { action: "confirm", eventId: packed.commandId }))
        .status === 409,
      "stale delivery event rejected",
    );
    ok(
      (
        await post(customer, {
          action: "confirm",
          eventId: final.id,
          confirmed: false,
        })
      ).status === 400,
      "receipt requires explicit consent",
    );
    ok(
      (await post(customer, { action: "confirm", eventId: final.id }))
        .status === 200,
      "customer confirms delivery rehearsal",
    );
    ok(
      (await post(customer, { action: "confirm", eventId: final.id }))
        .status === 200,
      "delivery confirmation retry idempotent",
    );
    ok(
      (await read("order_delivery_confirmations")).length === 1,
      "single rehearsal confirmation retained",
    );
    ok(
      (await post(owner, progress(5, 5), 3001)).status === 409,
      "confirmed history is closed",
    );
    ok(
      (
        await page(3000, `/orders/${order.id}/complete`, customer)
      ).text.includes("Made especially for you."),
      "completion screen unlocked for customer",
    );
    ok(
      (await page(3000, `/orders/${order.id}/delivery`, other)).status === 404,
      "other customer delivery page denied",
    );
    ok(
      (await page(3000, `/orders/${order.id}/complete`, other)).status === 404,
      "other customer completion page denied",
    );
    ok(
      (await page(3001, `/orders/${order.id}/delivery`, owner)).text.includes(
        "Delivery rehearsal confirmed",
      ),
      "owner sees rehearsal confirmation",
    );
    ok(
      !!(
        await owner.client
          .from("order_shipment_events")
          .update({ stage: 1 })
          .eq("id", final.id)
      ).error,
      "direct history changes denied",
    );
    const outbox = (
      await admin
        .from("outbox_events")
        .select("payload")
        .in(
          "aggregate_id",
          events.map((e) => e.id),
        )
    ).data;
    ok(
      outbox.length === 5 &&
        outbox.every(
          (e) => Object.keys(e.payload).sort().join() === "event_id,order_id",
        ),
      "outbox contains identifiers only",
    );
    await admin.from("boutiques").update({ owner_id: other.id }).eq("id", b.id);
    for (const who of [owner, other]) {
      ok(
        (
          await who.client
            .from("order_delivery_details")
            .select()
            .eq("order_id", order.id)
        ).data.length === 0,
        "ownership change does not expose address",
      );
      ok(
        (
          await who.client
            .from("order_shipment_events")
            .select()
            .eq("order_id", order.id)
        ).data.length === 0,
        "ownership change does not expose shipment history",
      );
      ok(
        (await post(who, progress(5, 5), 3001)).status === 409,
        "transferred owner cannot write history",
      );
    }
    await admin.from("boutiques").update({ owner_id: owner.id }).eq("id", b.id);
    await testAftercare({ admin, owner, customer, other, order, b, page });
    const unchanged = (
      await customer.client
        .from("customer_orders")
        .select()
        .eq("id", order.id)
        .single()
    ).data;
    ok(
      unchanged.status === order.status &&
        unchanged.total_paise === order.total_paise,
      "rehearsal does not change commercial order or payment",
    );
    assert.equal(
      (
        await customer.client.rpc("cancel_unpaid_order", {
          target_order: order.id,
          confirmed: true,
        })
      ).error,
      null,
    );
    ok(
      (
        await post(customer, {
          ...second,
          revision: 2,
          commandId: crypto.randomUUID(),
        })
      ).status === 409,
      "cancelled order rejects address updates",
    );
    ok(
      (await post(owner, progress(5, 5), 3001)).status === 409,
      "cancelled order rejects shipment updates",
    );
    ok(
      (await post(customer, { action: "confirm", eventId: final.id }))
        .status === 409,
      "cancelled order rejects confirmations",
    );
    ok(
      (
        await page(3000, `/orders/${order.id}/complete`, customer)
      ).text.includes("cancelled"),
      "cancelled order cannot present completion",
    );
    console.log(
      `Passed ${checks} fulfilment privacy, address, transition and completion checks.`,
    );
  } finally {
    await admin.from("boutiques").update({ owner_id: owner.id }).eq("id", b.id);
    await admin
      .from("customer_orders")
      .update({ status: order.status, cancelled_at: order.cancelled_at })
      .eq("id", order.id);
    await admin
      .from("order_design_reviews")
      .update({
        status: saved.status,
        feedback: saved.feedback,
        reviewed_at: saved.reviewed_at,
      })
      .eq("id", saved.id);
    const ids =
      (
        await admin
          .from("order_shipment_events")
          .select("id")
          .eq("order_id", order.id)
      ).data?.map((e) => e.id) ?? [];
    if (ids.length) {
      await admin.from("audit_events").delete().in("entity_id", ids);
      await admin.from("outbox_events").delete().in("aggregate_id", ids);
    }
    for (const t of [
      "order_delivery_confirmations",
      "order_shipment_events",
      "order_delivery_details",
      "order_production_updates",
    ])
      assert.equal(
        (await admin.from(t).delete().eq("order_id", order.id)).error,
        null,
      );
  }
}
