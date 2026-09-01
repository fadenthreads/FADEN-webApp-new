"use client";
import { useState } from "react";
import { productionStages, type ProductionCard } from "./production-model";
export function ProductionBoard({
  orders,
  demo = false,
}: {
  orders: ProductionCard[];
  demo?: boolean;
}) {
  const [stage, setStage] = useState(-1),
    [search, setSearch] = useState(""),
    [table, setTable] = useState(false);
  const labels = ["Awaiting first update", ...productionStages];
  const visible = orders.filter(
    (o) =>
      (stage < 0 || stage === o.stage) &&
      `${o.title} ${o.boutique} ${o.id}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const card = (o: ProductionCard) => (
    <article className="production-card" key={o.id}>
      <small>Order · {o.id.slice(0, 8)}</small>
      <span className="production-tag">Rehearsal</span>
      <h2>{o.title}</h2>
      <p>{o.boutique}</p>
      <dl>
        <div>
          <dt>Recorded stage</dt>
          <dd>{labels[o.stage]}</dd>
        </div>
        <div>
          <dt>Last update</dt>
          <dd>
            {o.updatedAt
              ? new Date(o.updatedAt).toLocaleDateString("en-IN")
              : "Not started"}
          </dd>
        </div>
      </dl>
      {o.href ? (
        <a href={o.href}>
          {demo ? "View sample journey" : "View / update order"} →
        </a>
      ) : (
        <p className="production-tag">Sample card · no linked order</p>
      )}
    </article>
  );
  return (
    <section className="production-board">
      <header>
        <div>
          <h1>Production Board</h1>
          <p>Active orders lifecycle</p>
        </div>
        <button
          className="offer-btn"
          onClick={() => setTable(!table)}
          aria-pressed={table}
        >
          {table ? "Board view" : "List view"}
        </button>
      </header>
      <p className="design-notice">
        {demo ? "Fictional sample orders. " : ""}Rehearsal workspace — these
        updates do not authorize real production, collect money or book a
        fitting.
      </p>
      <div className="production-toolbar">
        <label>
          Find order
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Design, boutique or order ID"
          />
        </label>
        <label>
          Milestone
          <select
            value={stage}
            onChange={(e) => setStage(Number(e.target.value))}
          >
            <option value={-1}>All stages</option>
            {labels.map((s, i) => (
              <option key={s} value={i}>
                {s} ({orders.filter((o) => o.stage === i).length})
              </option>
            ))}
          </select>
        </label>
      </div>
      <p role="status">{visible.length} orders shown on this page</p>
      {!visible.length ? (
        <div className="design-empty">
          No orders match this view. Accepted orders appear here; design
          approval is required to add progress.
        </div>
      ) : (
        <>
          <div className="production-columns" data-list={table}>
            {labels.map((s, i) => (
              <section key={s} hidden={!visible.some((o) => o.stage === i)}>
                <h2>
                  {s} <span>{visible.filter((o) => o.stage === i).length}</span>
                </h2>
                {visible.filter((o) => o.stage === i).map(card)}
                {!visible.some((o) => o.stage === i) && (
                  <p className="production-empty">No orders in this stage</p>
                )}
              </section>
            ))}
          </div>
          <div className="production-list" data-list={table}>
            {visible.map(card)}
          </div>
        </>
      )}
    </section>
  );
}
