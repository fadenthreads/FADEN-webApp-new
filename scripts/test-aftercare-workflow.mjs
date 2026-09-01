import assert from "node:assert/strict";
export async function testAftercare({
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
  async function post(
    who,
    body,
    port = 3000,
    origin = `http://localhost:${port}`,
  ) {
    const r = await fetch(`http://localhost:${port}/api/aftercare`, {
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
  const submission = (kind = "alteration") => ({
    action: "submit",
    kind,
    rating: kind === "review" ? 5 : null,
    note: "Private fixture feedback. Please review the sleeve finish.",
    commandId: crypto.randomUUID(),
  });
  const response = (id, version, status) => ({
    action: "update",
    itemId: id,
    version,
    status,
    note: "Rehearsal response only. No real alteration work is arranged.",
    commandId: crypto.randomUUID(),
  });
  const confirmation = (
    await admin
      .from("order_delivery_confirmations")
      .select()
      .eq("order_id", order.id)
      .single()
  ).data;
  try {
    const review = submission("review");
    ok((await post(null, review)).status === 401, "anonymous review rejected");
    ok(
      (await post(customer, review, 3000, "https://other.example")).status ===
        403,
      "cross-origin aftercare rejected",
    );
    ok(
      (await post(owner, review)).status === 409,
      "owner cannot author customer review",
    );
    ok(
      (await post(other, review)).status === 409,
      "other customer cannot author review",
    );
    ok(
      (await post(customer, { ...review, confirmed: false })).status === 400,
      "explicit review confirmation required",
    );
    ok(
      (await post(customer, { ...review, rating: 6 })).status === 409,
      "rating out of bounds rejected",
    );
    ok(
      (await post(customer, { ...review, note: "tiny" })).status === 409,
      "short note rejected",
    );
    assert.equal(
      (
        await admin
          .from("order_delivery_confirmations")
          .delete()
          .eq("order_id", order.id)
      ).error,
      null,
    );
    ok(
      (await post(customer, review)).status === 409,
      "aftercare requires delivery confirmation",
    );
    assert.equal(
      (await admin.from("order_delivery_confirmations").insert(confirmation))
        .error,
      null,
    );
    ok(
      (await post(customer, review)).status === 200,
      "customer saves private preview review",
    );
    ok(
      (await post(customer, review)).status === 200,
      "review retry idempotent",
    );
    ok(
      (await post(customer, { ...review, rating: 4 })).status === 409,
      "retry cannot change rating",
    );
    ok(
      (await post(customer, submission("review"))).status === 409,
      "one review per order",
    );
    const reviews = (
      await customer.client
        .from("order_aftercare_items")
        .select()
        .eq("order_id", order.id)
    ).data;
    ok(
      reviews.length === 1 && reviews[0].mode === "rehearsal",
      "review isolated in rehearsal storage",
    );
    ok(
      (
        await other.client
          .from("order_aftercare_items")
          .select()
          .eq("order_id", order.id)
      ).data.length === 0,
      "review not exposed to other customers",
    );
    ok(
      (await post(owner, response(review.commandId, 1, "accepted"), 3001))
        .status === 409,
      "owner cannot modify review",
    );
    ok(
      !!(
        await customer.client
          .from("order_aftercare_items")
          .update({ rating: 1 })
          .eq("id", review.commandId)
      ).error,
      "direct review rewriting denied",
    );
    const race = await Promise.all([
      post(customer, submission()),
      post(customer, submission()),
    ]);
    ok(
      race.filter((x) => x.status === 200).length === 1 &&
        race.filter((x) => x.status === 409).length === 1,
      "one active alteration under concurrent submission",
    );
    const id = race.find((x) => x.status === 200).body.id;
    ok(
      (await post(customer, response(id, 1, "accepted"))).status === 409,
      "customer cannot accept as boutique",
    );
    ok(
      (await post(owner, response(id, 1, "ready"), 3001)).status === 409,
      "owner cannot skip acceptance",
    );
    const accept = response(id, 1, "accepted");
    ok(
      (await post(owner, { ...accept, confirmed: false }, 3001)).status === 400,
      "response confirmation required",
    );
    ok(
      (await post(owner, accept, 3001)).status === 200,
      "owner accepts alteration rehearsal",
    );
    ok(
      (await post(owner, accept, 3001)).status === 200,
      "response retry idempotent",
    );
    ok(
      (
        await post(
          owner,
          { ...accept, note: "Changed response with reused command" },
          3001,
        )
      ).status === 409,
      "response ID cannot change note",
    );
    ok(
      (await post(customer, response(id, 2, "cancelled"))).status === 409,
      "accepted request cannot be silently cancelled",
    );
    ok(
      (await post(owner, response(id, 1, "declined"), 3001)).status === 409,
      "stale response rejected",
    );
    ok(
      (await post(owner, response(id, 2, "closed"), 3001)).status === 409,
      "owner cannot close for customer",
    );
    ok(
      (await post(owner, response(id, 2, "ready"), 3001)).status === 200,
      "owner marks rehearsal ready",
    );
    const close = response(id, 3, "closed");
    ok(
      (await post(customer, close)).status === 200,
      "customer closes ready request",
    );
    ok(
      (await post(customer, close)).status === 200,
      "customer close retry idempotent",
    );
    ok(
      (await post(owner, response(id, 4, "accepted"), 3001)).status === 409,
      "closed request cannot reopen",
    );
    const history = (
      await customer.client
        .from("order_aftercare_events")
        .select()
        .eq("item_id", id)
        .order("version")
    ).data;
    ok(
      history.length === 3 &&
        history.map((x) => x.status).join() === "accepted,ready,closed",
      "response history retained without duplicates",
    );
    ok(
      (
        await other.client
          .from("order_aftercare_events")
          .select()
          .eq("item_id", id)
      ).data.length === 0,
      "response history private",
    );
    ok(
      !!(
        await owner.client
          .from("order_aftercare_events")
          .update({ note: "Forged response" })
          .eq("item_id", id)
      ).error,
      "direct history rewriting blocked",
    );
    const second = submission();
    ok(
      (await post(customer, second)).status === 200,
      "new request allowed after closure",
    );
    ok(
      (await post(owner, response(second.commandId, 1, "declined"), 3001))
        .status === 200,
      "owner can decline with a reason",
    );
    const third = submission();
    assert.equal((await post(customer, third)).status, 200);
    ok(
      (await post(customer, response(third.commandId, 1, "cancelled")))
        .status === 200,
      "customer can cancel pending request",
    );
    ok(
      (
        await page(3000, `/orders/${order.id}/aftercare`, customer)
      ).text.includes("Private fixture feedback"),
      "customer aftercare page renders review",
    );
    ok(
      (await page(3001, `/orders/${order.id}/aftercare`, owner)).text.includes(
        "Closed by customer",
      ),
      "Studio sees closed history",
    );
    ok(
      (await page(3000, `/orders/${order.id}/aftercare`, other)).status === 404,
      "other customer page denied",
    );
    await admin.from("boutiques").update({ owner_id: other.id }).eq("id", b.id);
    for (const who of [owner, other]) {
      ok(
        (
          await who.client
            .from("order_aftercare_items")
            .select()
            .eq("order_id", order.id)
        ).data.length === 0,
        "ownership transfer does not expose feedback",
      );
      ok(
        (await post(who, response(id, 4, "ready"), 3001)).status === 409,
        "transferred owner cannot respond",
      );
    }
    ok(
      (await post(customer, submission())).status === 409,
      "new aftercare blocked without original boutique",
    );
    await admin.from("boutiques").update({ owner_id: owner.id }).eq("id", b.id);
    const events = (
      await admin
        .from("outbox_events")
        .select("payload")
        .in("aggregate_id", [
          review.commandId,
          id,
          second.commandId,
          third.commandId,
          ...history.map((x) => x.id),
        ])
    ).data;
    ok(
      events.length === 7 &&
        events.every((e) =>
          Object.keys(e.payload).every((k) =>
            ["item_id", "order_id", "event_id"].includes(k),
          ),
        ),
      "outbox has identifiers only",
    );
    const actual = (
      await admin.from("customer_orders").select().eq("id", order.id).single()
    ).data;
    ok(
      actual.status === order.status &&
        actual.total_paise === order.total_paise,
      "aftercare does not change order payment",
    );
    await admin
      .from("customer_orders")
      .update({ status: "cancelled" })
      .eq("id", order.id);
    ok(
      (await post(customer, submission())).status === 409,
      "cancelled order rejects aftercare",
    );
    ok(
      (await post(owner, response(id, 4, "ready"), 3001)).status === 409,
      "cancelled order rejects responses",
    );
    console.log(
      `Passed ${checks} aftercare permission, history and transition checks.`,
    );
  } finally {
    await admin.from("boutiques").update({ owner_id: owner.id }).eq("id", b.id);
    await admin
      .from("customer_orders")
      .update({ status: order.status, cancelled_at: order.cancelled_at })
      .eq("id", order.id);
    const items =
      (
        await admin
          .from("order_aftercare_items")
          .select("id")
          .eq("order_id", order.id)
      ).data ?? [];
    if (items.length) {
      const ids = items.map((x) => x.id);
      const ev =
        (
          await admin
            .from("order_aftercare_events")
            .select("id")
            .in("item_id", ids)
        ).data ?? [];
      const all = [...ids, ...ev.map((x) => x.id)];
      await admin.from("audit_events").delete().in("entity_id", all);
      await admin.from("outbox_events").delete().in("aggregate_id", all);
      assert.equal(
        (await admin.from("order_aftercare_events").delete().in("item_id", ids))
          .error,
        null,
      );
      assert.equal(
        (await admin.from("order_aftercare_items").delete().in("id", ids))
          .error,
        null,
      );
    }
  }
}
