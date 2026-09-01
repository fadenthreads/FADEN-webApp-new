import assert from "node:assert/strict";
export async function testMessaging({
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
  const ids = [];
  const draft = (body = "Please keep the sleeve finish simple.") => ({
    action: "send",
    orderId: order.id,
    body,
    commandId: crypto.randomUUID(),
  });
  async function post(
    who,
    body,
    port = 3000,
    origin = `http://localhost:${port}`,
  ) {
    const r = await fetch(`http://localhost:${port}/api/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        ...(who ? { Cookie: who.cookie } : {}),
      },
      body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json() };
  }
  const read = (through) => ({ action: "read", orderId: order.id, through });
  try {
    const first = draft();
    ids.push(first.commandId);
    ok((await post(null, first)).status === 401, "anonymous denied");
    ok(
      (await post(customer, first, 3000, "https://outside.example")).status ===
        403,
      "cross origin denied",
    );
    ok((await post(other, first)).status === 409, "unrelated user denied");
    ok(
      (await post(customer, draft("   "))).status === 409,
      "empty message denied",
    );
    ok(
      (await post(customer, draft("x".repeat(2001)))).status === 409,
      "oversized text denied",
    );
    ok(
      (await post(customer, draft("x".repeat(13000)))).status === 413,
      "oversized request denied",
    );
    ok((await post(customer, first)).status === 200, "customer sends");
    ok((await post(customer, first)).status === 200, "retry succeeds");
    ok(
      (await post(customer, { ...first, body: "Changed" })).status === 409,
      "retry cannot change body",
    );
    ok(
      (await post(owner, first, 3001)).status === 409,
      "sender cannot claim another message",
    );
    const reply = draft(
      "<script>alert('not executable')</script>\nA plain text response.",
    );
    ids.push(reply.commandId);
    ok((await post(owner, reply, 3001)).status === 200, "boutique replies");
    const history = await customer.client
      .from("order_messages")
      .select()
      .eq("order_id", order.id)
      .order("sequence");
    ok(
      history.data.length === 2 && history.data[1].sequence === 2,
      "retry has one message and ordered history",
    );
    ok(
      (
        await other.client
          .from("order_messages")
          .select()
          .eq("order_id", order.id)
      ).data.length === 0,
      "RLS hides other conversation",
    );
    ok(
      !!(
        await customer.client.from("order_messages").insert({
          id: crypto.randomUUID(),
          order_id: order.id,
          sequence: 3,
          sender_id: other.id,
          body: "spoof",
        })
      ).error,
      "direct insert denied",
    );
    ok(
      !!(
        await owner.client
          .from("order_messages")
          .update({ body: "edited" })
          .eq("id", first.commandId)
      ).error,
      "direct update denied",
    );
    ok(
      !!(
        await customer.client
          .from("order_messages")
          .delete()
          .eq("id", first.commandId)
      ).error,
      "direct delete denied",
    );
    ok(
      (await post(other, read(2))).status === 409,
      "other user cannot mark read",
    );
    ok(
      (await post(customer, read(3))).status === 409,
      "future read cursor denied",
    );
    ok(
      (await post(customer, read(2))).status === 200,
      "customer marks displayed messages read",
    );
    ok(
      (await post(customer, read(1))).status === 200,
      "stale read cursor is harmless",
    );
    ok(
      (
        await customer.client
          .from("order_message_reads")
          .select()
          .eq("order_id", order.id)
      ).data[0].last_sequence === 2,
      "cursor never regresses",
    );
    ok(
      (
        await owner.client
          .from("order_message_reads")
          .select()
          .eq("order_id", order.id)
      ).data.length === 0,
      "reader state private to reader",
    );
    ok(
      !!(
        await customer.client
          .from("order_message_reads")
          .insert({ order_id: order.id, reader_id: other.id, last_sequence: 2 })
      ).error,
      "direct cursor spoof denied",
    );
    const customerPage = await page(
      3000,
      `/orders/${order.id}/messages`,
      customer,
    );
    ok(
      customerPage.status === 200 &&
        customerPage.text.includes("0") &&
        customerPage.text.includes("unread"),
      "customer conversation renders",
    );
    ok(
      !customerPage.text.includes("<script>alert('not executable')</script>"),
      "message HTML not executable",
    );
    ok(
      (await page(3001, `/orders/${order.id}/messages`, owner)).status === 200,
      "studio conversation renders",
    );
    ok(
      (await page(3000, `/orders/${order.id}/messages`, other)).status === 404,
      "other customer page denied",
    );
    ok(
      (await page(3001, `/orders/${order.id}/messages`, other)).status === 404,
      "other studio page denied",
    );
    await admin.from("boutiques").update({ owner_id: other.id }).eq("id", b.id);
    ok(
      (
        await owner.client
          .from("order_messages")
          .select()
          .eq("order_id", order.id)
      ).data.length === 0,
      "former owner loses reads",
    );
    ok(
      (
        await other.client
          .from("order_messages")
          .select()
          .eq("order_id", order.id)
      ).data.length === 0,
      "new owner never inherits history",
    );
    ok(
      (await post(owner, draft(), 3001)).status === 409,
      "former owner cannot send",
    );
    ok(
      (await post(customer, draft())).status === 409,
      "customer send paused on transfer",
    );
    ok(
      (await post(owner, read(2), 3001)).status === 409,
      "former owner cannot mark read",
    );
    ok(
      (
        await customer.client
          .from("order_messages")
          .select()
          .eq("order_id", order.id)
      ).data.length === 2,
      "customer retains history",
    );
    await admin.from("boutiques").update({ owner_id: owner.id }).eq("id", b.id);
    await admin
      .from("customer_orders")
      .update({ status: "cancelled" })
      .eq("id", order.id);
    ok(
      (await post(customer, draft())).status === 409,
      "cancelled order cannot send",
    );
    ok(
      (await post(owner, read(2), 3001)).status === 200,
      "cancelled history can be read",
    );
    await admin
      .from("customer_orders")
      .update({ status: order.status })
      .eq("id", order.id);
    // Local-only fixtures exercise deterministic 50-message pagination and rate limits.
    const rows = Array.from({ length: 50 }, (_, i) => ({
      id: crypto.randomUUID(),
      order_id: order.id,
      sequence: i + 3,
      sender_id: owner.id,
      body: `History fixture ${i + 3}`,
      created_at: "2026-01-01T00:00:00Z",
    }));
    ids.push(...rows.map((r) => r.id));
    assert.equal((await admin.from("order_messages").insert(rows)).error, null);
    const latest = await page(3000, `/orders/${order.id}/messages`, customer);
    ok(
      latest.text.includes("Older messages") &&
        !latest.text.includes("Please keep the sleeve finish simple."),
      "latest page bounded to fifty",
    );
    const older = await page(
      3000,
      `/orders/${order.id}/messages?before=3`,
      customer,
    );
    ok(
      older.text.includes("Please keep the sleeve finish simple.") &&
        older.text.includes("Latest messages"),
      "older page retains first messages",
    );
    assert.equal(
      (
        await admin
          .from("order_messages")
          .update({ created_at: new Date().toISOString() })
          .eq("id", first.commandId)
      ).error,
      null,
    );
    for (let i = 0; i < 19; i++) {
      const d = draft(`Rate fixture ${i}`);
      ids.push(d.commandId);
      assert.equal((await post(customer, d)).status, 200);
    }
    ok(
      (await post(customer, draft())).status === 409,
      "twenty messages per minute per sender and order enforced",
    );
    const audit = await admin
      .from("audit_events")
      .select()
      .eq("action", "order.message_sent")
      .in("entity_id", ids);
    ok(
      audit.data.length === 21 &&
        !JSON.stringify(audit.data).includes("Please keep"),
      "audit records identifiers not message bodies",
    );
    const lastId = crypto.randomUUID();
    ids.push(lastId);
    assert.equal(
      (
        await admin.from("order_messages").insert({
          id: lastId,
          order_id: order.id,
          sequence: 500,
          sender_id: owner.id,
          body: "Limit fixture",
          created_at: "2026-01-01T00:00:00Z",
        })
      ).error,
      null,
    );
    const limit = await post(owner, draft(), 3001);
    ok(
      limit.status === 409 && limit.body.error.includes("limit reached"),
      "preview history cap enforced",
    );
    const cursor = (
      await customer.client
        .from("order_message_reads")
        .select("last_sequence")
        .eq("order_id", order.id)
        .single()
    ).data.last_sequence;
    const count = await customer.client
      .from("order_messages")
      .select("id", { head: true, count: "exact" })
      .eq("order_id", order.id)
      .neq("sender_id", customer.id)
      .gt("sequence", cursor);
    ok(count.count === 51, "unread counts only incoming messages above cursor");
    ok(
      (await post(customer, read(52))).status === 200,
      "older displayed messages can be marked read",
    );
    const remaining = await customer.client
      .from("order_messages")
      .select("id", { head: true, count: "exact" })
      .eq("order_id", order.id)
      .neq("sender_id", customer.id)
      .gt("sequence", 52);
    ok(remaining.count === 1, "unseen newer message remains unread");
    console.log(`Messaging: ${checks} checks passed.`);
  } finally {
    await admin.from("boutiques").update({ owner_id: owner.id }).eq("id", b.id);
    await admin
      .from("customer_orders")
      .update({ status: order.status })
      .eq("id", order.id);
    await admin.from("order_message_reads").delete().eq("order_id", order.id);
    await admin.from("order_messages").delete().eq("order_id", order.id);
    if (ids.length)
      await admin
        .from("audit_events")
        .delete()
        .eq("action", "order.message_sent")
        .in("entity_id", ids);
  }
}
