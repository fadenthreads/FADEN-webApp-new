import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
export async function testStudio({ admin, owner, customer, other, b, page }) {
  let checks = 0;
  const ok = (v, m) => {
    assert.ok(v, m);
    checks++;
  };
  const image = JSON.parse(
    readFileSync(
      new URL("../design-reference/stitch/assets.json", import.meta.url),
    ),
  ).assets.find((a) => a.id === "asset-057").sourceUrl;
  let id = crypto.randomUUID();
  const draft = {
    action: "create",
    id,
    boutiqueId: b.id,
    title: "Studio fixture bridal gown",
    description: "Local portfolio test only",
    price: "25000.55",
    status: "draft",
    image,
    occasions: ["Bridal"],
    minWeeks: 3,
    maxWeeks: 6,
    confirmPublished: false,
  };
  async function post(who, body, origin = "http://localhost:3001") {
    const r = await fetch("http://localhost:3001/api/portfolio", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...(who ? { Cookie: who.cookie } : {}),
      },
      body: JSON.stringify(body),
    });
    return { status: r.status, data: await r.json() };
  }
  const load = async () => {
    const r = await admin.from("designs").select().eq("id", id).single();
    assert.equal(r.error, null);
    return r.data;
  };
  try {
    assert.equal(
      (
        await admin.from("boutique_members").insert({
          boutique_id: b.id,
          user_id: owner.id,
          role: "boutique_owner",
        })
      ).error,
      null,
    );
    ok(
      (await page(3001, "/preview/overview")).status === 200,
      "public overview sample",
    );
    ok(
      (await page(3001, "/preview/portfolio")).status === 200,
      "public portfolio sample",
    );
    ok(
      (await page(3001, "/portfolio")).status === 307,
      "private portfolio requires sign-in",
    );
    ok(
      (await page(3001, "/")).status === 307,
      "real overview requires sign-in",
    );
    ok((await post(null, draft)).status === 401, "anonymous API denied");
    ok(
      (await post(owner, draft, "https://outside.example")).status === 403,
      "cross origin denied",
    );
    ok(
      (await post(customer, draft)).status === 403,
      "customer cannot create portfolio",
    );
    ok(
      (await post(other, draft)).status === 403,
      "unrelated user cannot create portfolio",
    );
    ok(
      (await post(owner, { ...draft, title: "x" })).status === 400,
      "short title denied",
    );
    ok(
      (await post(owner, { ...draft, price: "-1" })).status === 400,
      "negative price denied",
    );
    ok(
      (await post(owner, { ...draft, price: "1.999" })).status === 400,
      "excess price precision denied",
    );
    ok(
      (await post(owner, { ...draft, minWeeks: 7 })).status === 400,
      "inverted lead time denied",
    );
    ok(
      (await post(owner, { ...draft, image: "javascript:alert(1)" })).status ===
        400,
      "unsafe image denied",
    );
    ok(
      (
        await post(owner, {
          ...draft,
          image: "https://tracking.example/photo.jpg",
        })
      ).status === 400,
      "arbitrary tracking image denied",
    );
    ok(
      (await post(owner, { ...draft, status: "published" })).status === 400,
      "publishing needs explicit confirmation",
    );
    ok(
      (
        await post(owner, {
          ...draft,
          status: "published",
          confirmPublished: true,
          image: "",
        })
      ).status === 400,
      "publishing needs image",
    );
    const created = await post(owner, draft);
    ok(
      created.status === 200,
      `owner creates draft: ${JSON.stringify(created)}`,
    );
    id = created.data.id;
    ok((await load()).base_price_paise === 2500055, "paise preserved");
    ok(
      (await post(owner, draft)).status === 200,
      "identical create retry succeeds",
    );
    ok(
      (await post(owner, { ...draft, title: "Different title" })).status ===
        409,
      "reference reuse cannot create duplicate",
    );
    ok(
      (await customer.client.from("designs").select("id").eq("id", id)).data
        .length === 0,
      "draft hidden from customer",
    );
    const privatePage = await page(
      3001,
      `/portfolio?boutique=${b.id}&status=draft&category=Bridal&q=Studio%20fixture`,
      owner,
    );
    ok(
      privatePage.status === 200 && privatePage.text.includes(draft.title),
      "owner search/status/category filters return draft",
    );
    ok(
      !(
        await page(3001, `/portfolio?boutique=${b.id}&status=published`, owner)
      ).text.includes(draft.title),
      "status filter excludes draft",
    );
    ok(
      (await page(3001, `/portfolio?boutique=${b.id}`, other)).status !== 200,
      "unrelated user cannot open portfolio",
    );
    const overview = await page(3001, "/", owner);
    ok(
      overview.status === 200 &&
        overview.text.includes("Local design fixture") &&
        overview.text.includes("Live payments deferred"),
      "overview shows consented real request and deferred payments",
    );
    ok(
      !overview.text.includes("PRIVATE NEVER SHARED"),
      "overview omits private draft",
    );
    ok(
      !(await page(3001, "/", other)).text.includes("Local design fixture"),
      "other owner does not inherit dashboard data",
    );
    let current = await load();
    const publish = {
      ...draft,
      id,
      action: "update",
      version: current.updated_at,
      status: "published",
      confirmPublished: true,
    };
    ok(
      (await post(customer, publish)).status === 403,
      "customer cannot publish",
    );
    ok(
      (await post(owner, publish)).status === 200,
      "owner publishes confirmed design",
    );
    ok(
      (await customer.client.from("designs").select("id").eq("id", id)).data
        .length === 1,
      "published design visible in verified public boutique",
    );
    ok(
      (await post(owner, { ...publish, title: "Stale update" })).status === 409,
      "stale edit rejected",
    );
    current = await load();
    const races = await Promise.all([
      post(owner, {
        ...publish,
        version: current.updated_at,
        title: "Studio fixture version A",
      }),
      post(owner, {
        ...publish,
        version: current.updated_at,
        title: "Studio fixture version B",
      }),
    ]);
    ok(
      races.filter((r) => r.status === 200).length === 1 &&
        races.filter((r) => r.status === 409).length === 1,
      "concurrent editors cannot overwrite each other",
    );
    current = await load();
    ok(
      (
        await post(owner, {
          ...draft,
          action: "update",
          id,
          version: current.updated_at,
          status: "archived",
        })
      ).status === 200,
      "owner archives without deleting",
    );
    ok(
      (await customer.client.from("designs").select("id").eq("id", id)).data
        .length === 0,
      "archived design hidden from discovery",
    );
    const rows = Array.from({ length: 25 }, (_, i) => ({
      id: crypto.randomUUID(),
      boutique_id: b.id,
      title: `Pagination fixture ${String(i).padStart(2, "0")}`,
      slug: `portfolio-page-${crypto.randomUUID()}`,
      status: "draft",
      base_price_paise: 10000,
      lead_time_min_weeks: 1,
      lead_time_max_weeks: 2,
      primary_image_url: "",
    }));
    assert.equal((await admin.from("designs").insert(rows)).error, null);
    const first = await page(
        3001,
        `/portfolio?boutique=${b.id}&q=Pagination`,
        owner,
      ),
      last = await page(
        3001,
        `/portfolio?boutique=${b.id}&q=Pagination&page=2`,
        owner,
      );
    ok(
      first.status === 200 && first.text.includes("Next →"),
      "server pagination exposes next page",
    );
    ok(
      last.status === 200 && last.text.includes("← Previous"),
      "server pagination returns remaining rows",
    );
    const literal = await page(
      3001,
      `/portfolio?boutique=${b.id}&q=%25`,
      owner,
    );
    ok(
      literal.status === 200 && literal.text.includes("No designs match"),
      "search wildcard treated literally",
    );
    await admin
      .from("boutiques")
      .update({ is_published: false })
      .eq("id", b.id);
    current = await load();
    ok(
      (await post(owner, { ...publish, version: current.updated_at }))
        .status === 409,
      "unpublished boutique cannot publish through editor",
    );
    console.log(`Studio overview/portfolio: ${checks} checks passed.`);
  } finally {
    await admin.from("boutiques").update({ is_published: true }).eq("id", b.id);
    await admin.from("designs").delete().eq("boutique_id", b.id);
    await admin
      .from("boutique_members")
      .delete()
      .eq("boutique_id", b.id)
      .eq("user_id", owner.id);
  }
}
