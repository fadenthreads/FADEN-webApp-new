import Link from "next/link";
export type OverviewData = {
  name: string;
  welcome: string;
  publicHref?: string;
  requests: number;
  sent: number;
  orders: number;
  sessions: number;
  drafts: number;
  pendingSessions: number;
  recent: { id: string; label: string; garment: string; occasion: string }[];
  today: { id: string; order_id: string; starts_at: string; kind: string }[];
};
export function StudioOverview({
  data,
  demo = false,
}: {
  data: OverviewData;
  demo?: boolean;
}) {
  const portfolio = demo ? "/preview/portfolio" : "/portfolio";
  return (
    <>
      <header className="studio-page-heading">
        <div>
          <h1>Welcome, {data.welcome}.</h1>
          <p>Here is the current state of {data.name}.</p>
        </div>
        <div className="studio-actions">
          {data.publicHref ? (
            <a className="studio-button ghost" href={data.publicHref}>
              View Public Boutique ↗
            </a>
          ) : (
            <button className="studio-button ghost" disabled>
              Public boutique unavailable
            </button>
          )}
          <Link className="studio-button" href={portfolio + "#design-editor"}>
            New Portfolio Design
          </Link>
        </div>
      </header>
      <section className="studio-metrics" aria-label="Studio metrics">
        {[
          ["Payments Due", "—", "Live payments deferred"],
          ["Shared Requests", data.requests, "Active invitations"],
          ["Sent Offers", data.sent, "Includes sent offer history"],
          ["Accepted Orders", data.orders, "Non-cancelled orders"],
          ["Upcoming Fittings", data.sessions, "Preview reservations"],
        ].map(([label, value, hint]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </section>
      <div className="studio-overview-columns">
        <div>
          <section>
            <h2>◉ Needs Your Attention</h2>
            <div className="studio-attention">
              {data.drafts > 0 && (
                <article>
                  <span className="studio-initial">DR</span>
                  <div>
                    <h3>
                      {data.drafts} draft{" "}
                      {data.drafts === 1 ? "offer" : "offers"}
                    </h3>
                    <p>PROPOSALS NOT YET SENT</p>
                  </div>
                  <Link href="/offers">Review →</Link>
                </article>
              )}
              {data.pendingSessions > 0 && (
                <article>
                  <span className="studio-initial">MS</span>
                  <div>
                    <h3>
                      {data.pendingSessions}{" "}
                      {data.pendingSessions === 1
                        ? "session needs"
                        : "sessions need"}{" "}
                      an outcome
                    </h3>
                    <p>ENDED MEASUREMENT REHEARSALS</p>
                  </div>
                  <Link href="/appointments">Review →</Link>
                </article>
              )}
              {!data.drafts && !data.pendingSessions && (
                <p className="studio-empty">
                  You’re all caught up on draft offers and session outcomes.
                </p>
              )}
            </div>
          </section>
          <section className="studio-recent">
            <h2>
              Recent Requests <Link href="/requests">View All →</Link>
            </h2>
            <div className="studio-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Client & Event</th>
                    <th>Garment Type</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.label}
                        <small>{r.occasion}</small>
                      </td>
                      <td>{r.garment || "To discuss"}</td>
                      <td>
                        <span className="studio-chip">Shared</span>
                      </td>
                      <td>
                        {demo ? (
                          <span>Preview</span>
                        ) : (
                          <Link href={`/requests/${r.id}`}>Review →</Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.recent.length && (
              <p className="studio-empty">
                No active invitations yet. Private, unshared customer drafts
                never appear here.
              </p>
            )}
          </section>
        </div>
        <section className="studio-today">
          <h2>
            Today <small>IST</small>
          </h2>
          <div className="studio-timeline">
            {data.today.map((a) => (
              <article key={a.id}>
                <time dateTime={a.starts_at}>
                  {new Date(a.starts_at).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Kolkata",
                  })}
                </time>
                <h3>
                  {a.kind === "video"
                    ? "Video consultation"
                    : "In-person fitting"}
                </h3>
                <p>Measurement rehearsal</p>
                {demo ? (
                  <span className="studio-muted">Calls are not connected</span>
                ) : (
                  <Link href={`/orders/${a.order_id}/appointments`}>
                    View session →
                  </Link>
                )}
              </article>
            ))}
            {!data.today.length && (
              <p className="studio-muted">No confirmed sessions today.</p>
            )}
          </div>
          <Link href="/appointments?view=upcoming">View full schedule →</Link>
        </section>
      </div>
      <p className="studio-footnote">
        Counts reflect{" "}
        {demo ? "fictional examples" : "your accessible Supabase records"}. Sent
        offers include previously sent records; accepted orders may include
        completed rehearsals. No revenue, risk scores or reminders are
        fabricated. Live payments and calls remain off.
      </p>
    </>
  );
}
