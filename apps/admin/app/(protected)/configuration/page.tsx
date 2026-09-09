import { requireAdminSession } from "../../../lib/admin-session";

type DeliverySummary = {
  pending_count: number;
  failed_count: number;
  failed_events: Array<{
    id: number;
    event_type: string;
    attempts: number;
    created_at: string;
    last_error: string;
  }>;
};

export default async function AdminConfigurationPage() {
  const { supabase } = await requireAdminSession();
  const { data, error } = await supabase.rpc("admin_email_delivery_summary");
  const summary = (data ?? {
    pending_count: 0,
    failed_count: 0,
    failed_events: [],
  }) as unknown as DeliverySummary;

  return (
    <section
      className="admin-configuration"
      aria-labelledby="email-delivery-title"
    >
      <header>
        <p className="admin-eyebrow">Operations</p>
        <h1 id="email-delivery-title">Email delivery</h1>
        <p>
          Transactional messages are sent from the protected delivery worker.
          Recipient addresses and message contents are never shown here.
        </p>
      </header>
      {error ? (
        <p role="alert" className="admin-order-message">
          Delivery status is temporarily unavailable. Please refresh and try
          again.
        </p>
      ) : (
        <>
          <div className="admin-configuration__metrics">
            <article>
              <strong>{summary.pending_count}</strong>
              <span>Awaiting delivery</span>
            </article>
            <article>
              <strong>{summary.failed_count}</strong>
              <span>Needs attention</span>
            </article>
          </div>
          {summary.failed_events.length ? (
            <div className="admin-orders__table">
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Attempts</th>
                    <th>Reported</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.failed_events.map((event) => (
                    <tr key={event.id}>
                      <td>{event.event_type}</td>
                      <td>{event.attempts}</td>
                      <td>
                        {new Intl.DateTimeFormat("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Asia/Kolkata",
                        }).format(new Date(event.created_at))}
                      </td>
                      <td>Delivery failed</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="admin-configuration__empty">
              No failed email deliveries.
            </p>
          )}
        </>
      )}
    </section>
  );
}
