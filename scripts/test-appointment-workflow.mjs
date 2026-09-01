import assert from "node:assert/strict";
export async function testAppointments({
  admin,
  owner,
  customer,
  other,
  order,
  b,
  page,
}) {
  let checks = 0;
  const ok = (v, s) => {
    assert.ok(v, s);
    checks++;
  };
  const slotIds = [],
    requestIds = [],
    extraOrderIds = [];
  async function insert(t, body) {
    const { data, error } = await admin.from(t).insert(body).select().single();
    assert.equal(error, null);
    return data;
  }
  async function extraOrder(customerId) {
    const request = await insert("outfit_requests", {
      user_id: customerId,
      status: "submitted",
      draft: { notes: "PRIVATE APPOINTMENT FIXTURE" },
    });
    requestIds.push(request.id);
    const share = await insert("request_shares", {
      request_id: request.id,
      customer_id: customerId,
      boutique_id: b.id,
      client_label: "Appointment fixture",
      brief: { occasion: "Wedding" },
    });
    const old = (
      await admin
        .from("boutique_offers")
        .select()
        .eq("id", order.offer_id)
        .single()
    ).data;
    const offer = await insert("boutique_offers", {
      ...old,
      id: crypto.randomUUID(),
      request_id: request.id,
      share_id: share.id,
    });
    const o = await insert("customer_orders", {
      ...order,
      id: crypto.randomUUID(),
      customer_id: customerId,
      request_id: request.id,
      share_id: share.id,
      offer_id: offer.id,
    });
    extraOrderIds.push(o.id);
    return o;
  }
  async function post(who, body, origin = "http://localhost:3001") {
    const r = await fetch("http://localhost:3001/api/appointments", {
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
  const start = new Date(Date.now() + 4 * 86400000);
  start.setUTCMinutes(0, 0, 0);
  function slot(offset = 0, kind = "video") {
    const id = crypto.randomUUID();
    slotIds.push(id);
    return {
      action: "create",
      commandId: id,
      boutiqueId: b.id,
      start: new Date(+start + offset * 3600000).toISOString(),
      end: new Date(+start + (offset + 0.5) * 3600000).toISOString(),
      kind,
      location:
        kind === "video" ? "" : "Sample boutique, 42 Example Road, Chennai",
    };
  }
  const reserve = (o, s, replacing = null) => ({
    action: "reserve",
    orderId: o.id,
    slotId: s.commandId,
    commandId: crypto.randomUUID(),
    replacing,
    confirmed: true,
  });
  try {
    const s1 = slot(),
      s2 = slot(1, "boutique");
    ok((await post(null, s1)).status === 401, "anonymous availability denied");
    ok(
      (await post(customer, s1)).status === 409,
      "customer cannot create availability",
    );
    ok(
      (await post(owner, s1, "https://other.example")).status === 403,
      "cross-origin slots denied",
    );
    ok(
      (
        await post(owner, {
          ...s1,
          start: "2026-01-01T10:00:00Z",
          end: "2026-01-01T11:00:00Z",
        })
      ).status === 409,
      "past availability rejected",
    );
    const created = await post(owner, s1);
    ok(
      created.status === 200,
      `owner creates video availability: ${JSON.stringify(created.body)}`,
    );
    ok((await post(owner, s1)).status === 200, "availability retry idempotent");
    ok(
      (await post(owner, slot(0.25))).status === 409,
      "overlapping owner availability rejected",
    );
    ok(
      (await post(owner, s2)).status === 200,
      "owner creates in-person availability",
    );
    ok(
      (
        await customer.client
          .from("appointment_slots")
          .select()
          .eq("id", s1.commandId)
      ).data.length === 1,
      "order customer sees permitted availability",
    );
    ok(
      (
        await other.client
          .from("appointment_slots")
          .select()
          .eq("id", s1.commandId)
      ).data.length === 0,
      "unrelated user cannot see private address/availability",
    );
    const booking = reserve(order, s1);
    ok(
      (await post(owner, booking)).status === 409,
      "boutique cannot book as customer",
    );
    ok(
      (await post(customer, { ...booking, confirmed: false })).status === 400,
      "booking consent required",
    );
    const o2 = await extraOrder(other.id),
      o3 = await extraOrder(customer.id);
    const race = await Promise.all([
      post(customer, booking),
      post(other, reserve(o2, s1)),
    ]);
    ok(
      race.filter((r) => r.status === 200).length === 1,
      "competing customers cannot double-book a slot",
    );
    const winner = race[0].status === 200 ? customer : other;
    const wonOrder = winner === customer ? order : o2;
    const wonId = race.find((r) => r.status === 200).body.id;
    ok(
      (
        await customer.client
          .from("measurement_appointments")
          .select()
          .eq("id", wonId)
      ).data.length === (winner === customer ? 1 : 0),
      "booking privacy follows actual customer",
    );
    ok(
      (await post(owner, { action: "withdraw", slotId: s1.commandId }))
        .status === 409,
      "booked slot cannot be withdrawn",
    );
    const moved = reserve(wonOrder, s2, wonId);
    ok(
      (await post(winner, { ...moved, slotId: crypto.randomUUID() })).status ===
        409,
      "invalid reschedule rejected",
    );
    ok(
      (
        await winner.client
          .from("measurement_appointments")
          .select()
          .eq("id", wonId)
          .single()
      ).data.status === "confirmed",
      "failed reschedule preserves old booking",
    );
    ok(
      (await post(winner, moved)).status === 200,
      "reschedule succeeds atomically",
    );
    ok(
      (await post(winner, moved)).status === 200,
      "reschedule retry idempotent",
    );
    ok(
      (
        await winner.client
          .from("measurement_appointments")
          .select()
          .eq("id", wonId)
          .single()
      ).data.status === "rescheduled",
      "previous booking retained",
    );
    ok(
      (
        await post(winner, {
          action: "cancel",
          appointmentId: wonId,
          confirmed: true,
        })
      ).status === 409,
      "stale cancellation cannot cancel new booking",
    );
    ok(
      (
        await post(winner, {
          action: "cancel",
          appointmentId: moved.commandId,
          confirmed: true,
        })
      ).status === 200,
      "customer cancels own booking",
    );
    ok(
      (
        await post(winner, {
          action: "cancel",
          appointmentId: moved.commandId,
          confirmed: true,
        })
      ).status === 200,
      "cancellation idempotent",
    );
    const fresh = reserve(order, s1);
    ok(
      (await post(customer, fresh)).status === 200,
      "released slot can be reserved again",
    );
    ok(
      (await post(customer, fresh)).status === 200,
      "booking retry idempotent",
    );
    ok(
      (await post(customer, { ...fresh, slotId: s2.commandId })).status === 409,
      "same command cannot change slot",
    );
    // Service fixture tests customer conflicts independently of the owner slot-creation guard.
    const overlapId = crypto.randomUUID();
    slotIds.push(overlapId);
    await insert("appointment_slots", {
      id: overlapId,
      boutique_id: b.id,
      owner_id: owner.id,
      starts_at: s1.start,
      ends_at: s1.end,
      kind: "video",
      location: "",
    });
    ok(
      (await post(customer, reserve(o3, { commandId: overlapId }))).status ===
        409,
      "customer cannot book overlapping appointments across orders",
    );
    ok(
      !!(
        await customer.client
          .from("measurement_appointments")
          .update({ status: "cancelled" })
          .eq("id", fresh.commandId)
      ).error,
      "direct status forgery blocked",
    );
    ok(
      !!(
        await owner.client
          .from("appointment_slots")
          .update({ starts_at: s2.start })
          .eq("id", s1.commandId)
      ).error,
      "slot times immutable to clients",
    );
    ok(
      (
        await page(3000, `/orders/${order.id}/appointments`, customer)
      ).text.includes("Video measurement"),
      "customer appointment page renders booking",
    );
    ok(
      (await page(3000, `/orders/${order.id}/appointments`, other)).status ===
        404,
      "other customer cannot load booking page",
    );
    ok(
      (await page(3001, "/appointments", owner)).status === 200,
      "Studio schedule renders",
    );
    const current = (
      await customer.client
        .from("customer_orders")
        .select()
        .eq("id", order.id)
        .single()
    ).data;
    ok(
      current.status === order.status &&
        current.total_paise === order.total_paise,
      "booking does not change price or payment",
    );
    await admin.from("boutiques").update({ owner_id: other.id }).eq("id", b.id);
    ok(
      (
        await owner.client
          .from("measurement_appointments")
          .select()
          .eq("id", fresh.commandId)
      ).data.length === 0,
      "former owner loses appointment access",
    );
    ok(
      (
        await other.client
          .from("measurement_appointments")
          .select()
          .eq("id", fresh.commandId)
      ).data.length === 0,
      "new owner does not inherit customer's booking",
    );
    await admin.from("boutiques").update({ owner_id: owner.id }).eq("id", b.id);
    // Outcomes use isolated local fixture times, never the host clock or real bookings.
    const outcomeSlot = slot(10),
      followSlot = slot(11),
      movedSlot = slot(12),
      finalSlot = slot(13);
    for (const s of [outcomeSlot, followSlot, movedSlot, finalSlot])
      assert.equal((await post(owner, s)).status, 200);
    const firstSession = reserve(o3, outcomeSlot);
    assert.equal((await post(customer, firstSession)).status, 200);
    const outcome = {
      action: "outcome",
      appointmentId: firstSession.commandId,
      outcome: "completed",
      confirmed: true,
    };
    ok((await post(null, outcome)).status === 401, "anonymous outcome denied");
    ok(
      (await post(owner, outcome, "https://other.example")).status === 403,
      "cross-origin outcome denied",
    );
    ok(
      (await post(owner, { ...outcome, confirmed: false })).status === 400,
      "outcome confirmation required",
    );
    ok(
      (await post(owner, { ...outcome, outcome: "cancelled" })).status === 400,
      "invalid outcome rejected",
    );
    ok(
      (await post(customer, outcome)).status === 409,
      "customer cannot record own outcome",
    );
    ok(
      (await post(other, outcome)).status === 409,
      "outsider cannot record outcome",
    );
    ok(
      (await post(owner, outcome)).status === 409,
      "future session cannot be completed",
    );
    async function fixtureTime(bookingId, slotId, startOffset, endOffset) {
      const times = {
        starts_at: new Date(Date.now() + startOffset * 60000).toISOString(),
        ends_at: new Date(Date.now() + endOffset * 60000).toISOString(),
      };
      assert.equal(
        (await admin.from("appointment_slots").update(times).eq("id", slotId))
          .error,
        null,
      );
      assert.equal(
        (
          await admin
            .from("measurement_appointments")
            .update(times)
            .eq("id", bookingId)
        ).error,
        null,
      );
    }
    await fixtureTime(firstSession.commandId, outcomeSlot.commandId, -10, 20);
    ok(
      (await post(owner, outcome)).status === 409,
      "in-progress session cannot be completed",
    );
    await fixtureTime(firstSession.commandId, outcomeSlot.commandId, -60, -30);
    ok(
      (await page(3001, "/appointments?view=pending", owner)).text.includes(
        "Mark completed",
      ),
      "pending view exposes ended session controls",
    );
    ok(
      (await post(customer, reserve(o3, followSlot, firstSession.commandId)))
        .status === 409,
      "pending past session blocks replacement",
    );
    await admin.from("boutiques").update({ owner_id: other.id }).eq("id", b.id);
    ok(
      (await post(owner, outcome)).status === 409,
      "former owner cannot record outcome",
    );
    ok(
      (await post(other, outcome)).status === 409,
      "new owner cannot inherit outcome authority",
    );
    await admin.from("boutiques").update({ owner_id: owner.id }).eq("id", b.id);
    ok(
      (await post(owner, outcome)).status === 200,
      "owner records completed session",
    );
    ok(
      (await post(owner, outcome)).status === 200,
      "same outcome retry idempotent",
    );
    ok(
      (await post(owner, { ...outcome, outcome: "no_show" })).status === 409,
      "outcome cannot be rewritten",
    );
    const completed = (
      await customer.client
        .from("measurement_appointments")
        .select()
        .eq("id", firstSession.commandId)
        .single()
    ).data;
    ok(
      completed.status === "completed" &&
        completed.outcome_by === owner.id &&
        !!completed.outcome_at,
      "customer sees attributed timestamped outcome",
    );
    ok(
      (
        await admin
          .from("audit_events")
          .select("id")
          .eq("entity_id", firstSession.commandId)
          .eq("action", "appointment.completed")
      ).data.length === 1,
      "retry does not duplicate audit",
    );
    const events = (
      await admin
        .from("outbox_events")
        .select("payload")
        .eq("aggregate_id", firstSession.commandId)
        .eq("event_type", "appointment.preview_completed")
    ).data;
    ok(
      events.length === 1 &&
        Object.keys(events[0].payload).join() === "appointment_id",
      "outcome outbox is identifier-only and idempotent",
    );
    ok(
      (
        await other.client
          .from("measurement_appointments")
          .select()
          .eq("id", firstSession.commandId)
      ).data.length === 0,
      "outcome history private",
    );
    ok(
      !!(
        await owner.client
          .from("measurement_appointments")
          .update({ status: "no_show" })
          .eq("id", firstSession.commandId)
      ).error,
      "owner direct outcome forgery blocked",
    );
    ok(
      (
        await post(customer, {
          action: "cancel",
          appointmentId: firstSession.commandId,
          confirmed: true,
        })
      ).status === 409,
      "completed history cannot be cancelled",
    );
    ok(
      (
        await admin
          .from("appointment_slots")
          .select("state")
          .eq("id", outcomeSlot.commandId)
          .single()
      ).data.state === "booked",
      "elapsed slot remains historical",
    );
    const follow = reserve(o3, followSlot);
    ok(
      (await post(customer, follow)).status === 200,
      "customer can book follow-up after completion",
    );
    ok(
      (
        await customer.client
          .from("measurement_appointments")
          .select("follow_up_of")
          .eq("id", follow.commandId)
          .single()
      ).data.follow_up_of === firstSession.commandId,
      "follow-up linked automatically within order",
    );
    const movedFollow = reserve(o3, movedSlot, follow.commandId);
    ok(
      (await post(customer, movedFollow)).status === 200,
      "follow-up can be rescheduled",
    );
    ok(
      (
        await customer.client
          .from("measurement_appointments")
          .select("follow_up_of")
          .eq("id", movedFollow.commandId)
          .single()
      ).data.follow_up_of === firstSession.commandId,
      "reschedule preserves follow-up context",
    );
    ok(
      (await post(owner, { ...outcome, appointmentId: follow.commandId }))
        .status === 409,
      "rescheduled session cannot receive an outcome",
    );
    await fixtureTime(movedFollow.commandId, movedSlot.commandId, -60, -30);
    const noShow = {
      ...outcome,
      appointmentId: movedFollow.commandId,
      outcome: "no_show",
    };
    ok((await post(owner, noShow)).status === 200, "owner records no-show");
    const again = reserve(o3, finalSlot);
    ok(
      (await post(customer, again)).status === 200,
      "no-show permits customer-confirmed follow-up",
    );
    ok(
      (
        await customer.client
          .from("measurement_appointments")
          .select("follow_up_of")
          .eq("id", again.commandId)
          .single()
      ).data.follow_up_of === movedFollow.commandId,
      "latest outcome becomes follow-up parent",
    );
    await fixtureTime(again.commandId, finalSlot.commandId, -60, -30);
    const outcomeRace = await Promise.all([
      post(owner, { ...outcome, appointmentId: again.commandId }),
      post(owner, { ...noShow, appointmentId: again.commandId }),
    ]);
    ok(
      outcomeRace.filter((r) => r.status === 200).length === 1 &&
        outcomeRace.filter((r) => r.status === 409).length === 1,
      "competing outcomes cannot overwrite each other",
    );
    ok(
      (await page(3001, "/appointments?view=history", owner)).text.includes(
        "No-show",
      ),
      "Studio history renders outcomes",
    );
    ok(
      (
        await page(3000, `/orders/${o3.id}/appointments`, customer)
      ).text.includes("Reserve preview follow-up"),
      "customer sees follow-up action",
    );
    const untouched = (
      await admin.from("customer_orders").select().eq("id", o3.id).single()
    ).data;
    ok(
      untouched.status === o3.status &&
        untouched.total_paise === o3.total_paise,
      "outcomes do not change order or payment",
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
        await customer.client
          .from("measurement_appointments")
          .select()
          .eq("id", fresh.commandId)
          .single()
      ).data.status === "cancelled",
      "order cancellation cancels future appointment",
    );
    ok(
      (await post(customer, reserve(order, s2))).status === 409,
      "cancelled order cannot book",
    );
    ok(
      (await post(owner, { action: "withdraw", slotId: s1.commandId }))
        .status === 200,
      "unused availability can be withdrawn",
    );
    ok(
      (await post(other, reserve(o2, s1))).status === 409,
      "withdrawn slot cannot be booked",
    );
    console.log(
      `Passed ${checks} appointment booking, concurrency and privacy checks.`,
    );
  } finally {
    await admin.from("boutiques").update({ owner_id: owner.id }).eq("id", b.id);
    await admin
      .from("customer_orders")
      .update({ status: order.status, cancelled_at: order.cancelled_at })
      .eq("id", order.id);
    const orderIds = [order.id, ...extraOrderIds];
    const rows =
      (
        await admin
          .from("measurement_appointments")
          .select("id")
          .in("order_id", orderIds)
      ).data ?? [];
    if (rows.length) {
      const ids = rows.map((r) => r.id);
      await admin.from("audit_events").delete().in("entity_id", ids);
      await admin.from("outbox_events").delete().in("aggregate_id", ids);
      await admin.from("measurement_appointments").delete().in("id", ids);
    }
    if (slotIds.length)
      await admin.from("appointment_slots").delete().in("id", slotIds);
    if (extraOrderIds.length)
      await admin.from("customer_orders").delete().in("id", extraOrderIds);
    if (requestIds.length)
      await admin.from("outfit_requests").delete().in("id", requestIds);
  }
}
