import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// Runs inside the existing isolated local design fixture, never against hosted data.
export async function testProduction({
  admin,
  owner,
  customer,
  other,
  order,
  b,
  page,
}) {
  let checks = 0;
  const ok = (v, label) => {
    assert.ok(v, label);
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
  const ids = [],
    paths = [];
  const post = async (who, body, origin = "http://localhost:3001") => {
    const r = await fetch("http://localhost:3001/api/production", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        ...(who ? { Cookie: who.cookie } : {}),
      },
      body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json() };
  };
  const body = (sequence, stage, extra = {}) => ({
    orderId: order.id,
    commandId: crypto.randomUUID(),
    sequence,
    stage,
    note: "A private rehearsal progress note.",
    photo: null,
    confirmed: true,
    ...extra,
  });
  const rpc = (who, p) =>
    who.client.rpc("record_production_update", {
      target_order: p.orderId,
      expected_sequence: p.sequence,
      target_stage: p.stage,
      progress_note: p.note,
      photo: p.photo,
      command_id: p.commandId,
      confirmed: p.confirmed,
    });
  try {
    // Service-role fixture setup only; public approval is separately exercised by design tests.
    assert.equal(
      (
        await admin
          .from("order_design_reviews")
          .update({ status: "pending", feedback: "", reviewed_at: null })
          .eq("id", saved.id)
      ).error,
      null,
    );
    ok(
      (await post(owner, body(0, 1))).status === 409,
      "design approval gates progress",
    );
    assert.equal(
      (
        await admin
          .from("order_design_reviews")
          .update({
            status: "approved",
            feedback: "",
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", saved.id)
      ).error,
      null,
    );
    ok(
      (await post(null, body(0, 1))).status === 401,
      "anonymous progress requires sign-in",
    );
    ok(
      (await post(customer, body(0, 1))).status === 409,
      "customer cannot publish progress",
    );
    ok(
      (await post(other, body(0, 1))).status === 409,
      "outsider cannot publish progress",
    );
    ok(
      (await post(owner, body(0, 1), "https://other.example")).status === 403,
      "cross-origin progress rejected",
    );
    ok(
      (await post(owner, body(0, 1, { confirmed: false }))).status === 400,
      "rehearsal confirmation required",
    );
    ok(
      !!(await rpc(owner, body(0, 1, { confirmed: false }))).error,
      "direct RPC enforces confirmation",
    );
    ok(
      (await post(owner, body(0, 3))).status === 409,
      "first stage cannot skip fabric",
    );
    ok(
      (await post(owner, body(0, 1, { note: "short" }))).status === 409,
      "short note rejected",
    );
    ok(
      (
        await post(
          owner,
          body(0, 1, { photo: `${crypto.randomUUID()}/other.jpg` }),
        )
      ).status === 409,
      "cross-order photo rejected",
    );
    const path = `${order.id}/${crypto.randomUUID()}.jpg`;
    paths.push(path);
    const image = readFileSync(
      "apps/marketplace/public/stitch-assets/asset-061.jpg",
    );
    const tiny = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR3sAAAAASUVORK5CYII=",
      "base64",
    );
    ok(
      !!(
        await customer.client.storage
          .from("order-progress")
          .upload(path, tiny, { contentType: "image/png" })
      ).error,
      "customer photo upload rejected",
    );
    assert.equal(
      (
        await owner.client.storage
          .from("order-progress")
          .upload(path, image, { contentType: "image/jpeg" })
      ).error,
      null,
    );
    ok(
      !!(
        await customer.client.storage
          .from("order-progress")
          .createSignedUrl(path, 60)
      ).error,
      "unpublished progress photo private",
    );
    const first = body(0, 1, { photo: path });
    ids.push(first.commandId);
    const retries = await Promise.all([post(owner, first), post(owner, first)]);
    ok(
      retries.every((r) => r.status === 200 && r.body.id === first.commandId),
      "concurrent identical submissions idempotent",
    );
    ok(
      (
        await post(owner, {
          ...first,
          note: "Different data with same command key.",
        })
      ).status === 409,
      "idempotency key cannot rewrite content",
    );
    ok(
      (await post(owner, body(0, 1))).status === 409,
      "stale sequence rejected",
    );
    const signed = await customer.client.storage
      .from("order-progress")
      .createSignedUrl(path, 60);
    ok(
      !signed.error && (await fetch(signed.data.signedUrl)).status === 200,
      "customer sees own published photo",
    );
    ok(
      !!(
        await other.client.storage
          .from("order-progress")
          .createSignedUrl(path, 60)
      ).error,
      "outsider photo access denied",
    );
    ok(
      (
        await other.client
          .from("order_production_updates")
          .select()
          .eq("order_id", order.id)
      ).data.length === 0,
      "outsider history hidden",
    );
    ok(
      (
        await other.client
          .from("order_production_summary")
          .select()
          .eq("order_id", order.id)
      ).data.length === 0,
      "summary view inherits row security",
    );
    ok(
      !!(
        await owner.client
          .from("order_production_updates")
          .update({ note: "rewritten" })
          .eq("id", first.commandId)
      ).error,
      "history cannot be rewritten",
    );
    ok(
      !!(
        await customer.client
          .from("order_production_updates")
          .delete()
          .eq("id", first.commandId)
      ).error,
      "history cannot be deleted",
    );
    ok(
      !!(
        await owner.client.storage
          .from("order-progress")
          .update(path, tiny, { contentType: "image/png" })
      ).error,
      "photo overwrite denied",
    );
    await owner.client.storage.from("order-progress").remove([path]);
    ok(
      !(
        await customer.client.storage
          .from("order-progress")
          .createSignedUrl(path, 60)
      ).error,
      "published photo cannot be removed",
    );
    ok(
      (await post(owner, body(1, 3))).status === 409,
      "forward stage skipping rejected",
    );
    const competing = [body(1, 2), body(1, 2)];
    ids.push(...competing.map((p) => p.commandId));
    ok(
      (await Promise.all(competing.map((p) => post(owner, p)))).filter(
        (r) => r.status === 200,
      ).length === 1,
      "competing updates have one winner",
    );
    ok(
      (await post(owner, body(2, 1))).status === 409,
      "stage regression rejected",
    );
    const note = body(2, 2);
    ids.push(note.commandId);
    ok((await post(owner, note)).status === 200, "same-stage note accepted");
    for (const [sequence, stage] of [
      [3, 3],
      [4, 4],
      [5, 5],
    ]) {
      const p = body(sequence, stage);
      ids.push(p.commandId);
      ok(
        (await post(owner, p)).status === 200,
        `stage ${stage} advances in sequence`,
      );
    }
    ok(
      (await post(owner, body(6, 6))).status === 409,
      "unimplemented delivery stage rejected",
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
      "rehearsal leaves commercial order unchanged",
    );
    const updates = (
      await customer.client
        .from("order_production_updates")
        .select()
        .eq("order_id", order.id)
    ).data;
    ok(
      updates.length === 6 && updates.every((p) => p.mode === "rehearsal"),
      "all progress explicitly rehearsal",
    );
    ok(
      (await admin.from("outbox_events").select().in("aggregate_id", ids)).data
        .length === 6,
      "one outbox event per update",
    );
    const journey = await page(3000, `/journey/${order.id}`, customer);
    ok(
      journey.status === 200 &&
        journey.text.includes("A private rehearsal progress note.") &&
        journey.text.includes("Ready for fitting"),
      "customer journey includes own progress",
    );
    ok(
      !journey.text.includes("PRIVATE NEVER SHARED"),
      "progress does not expose private brief",
    );
    ok(
      (await page(3001, `/orders/${order.id}/production`, owner)).status ===
        200,
      "owner production editor renders",
    );
    ok(
      (await page(3001, `/orders/${order.id}/production`, other)).status ===
        404,
      "outsider editor blocked",
    );
    ok(
      (await page(3001, "/production", owner)).text.includes(
        order.id.slice(0, 8),
      ),
      "board lists owned order",
    );
    assert.equal(
      (
        await admin
          .from("boutiques")
          .update({ owner_id: other.id })
          .eq("id", b.id)
      ).error,
      null,
    );
    for (const who of [owner, other])
      ok(
        (
          await who.client
            .from("order_production_updates")
            .select()
            .eq("order_id", order.id)
        ).data.length === 0,
        "ownership transfer does not expose prior progress",
      );
    assert.equal(
      (
        await admin
          .from("boutiques")
          .update({ owner_id: owner.id })
          .eq("id", b.id)
      ).error,
      null,
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
      (await post(owner, body(6, 5))).status === 409,
      "cancelled order rejects progress",
    );
    ok(
      (await page(3001, `/orders/${order.id}/production`, owner)).text.includes(
        "read-only",
      ),
      "cancelled progress remains read-only",
    );
    console.log(
      `Passed ${checks} production rehearsal, storage, transition and privacy checks.`,
    );
  } finally {
    await admin.from("boutiques").update({ owner_id: owner.id }).eq("id", b.id);
    // Restore this isolated fixture for the parent suite's cancellation assertions.
    await admin
      .from("customer_orders")
      .update({ status: order.status })
      .eq("id", order.id);
    await admin
      .from("order_design_reviews")
      .update({
        status: saved.status,
        feedback: saved.feedback,
        reviewed_at: saved.reviewed_at,
      })
      .eq("id", saved.id);
    if (paths.length) await admin.storage.from("order-progress").remove(paths);
    if (ids.length) {
      await admin.from("outbox_events").delete().in("aggregate_id", ids);
      await admin.from("audit_events").delete().in("entity_id", ids);
    }
    await admin
      .from("order_production_updates")
      .delete()
      .eq("order_id", order.id);
  }
}
