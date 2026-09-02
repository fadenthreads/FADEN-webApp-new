import { AdminPlaceholder } from "../../components/admin-placeholder";

export default function AdminOverviewPage() {
  return (
    <>
      <AdminPlaceholder
        ticket="A02"
        title="Live platform metrics"
        description="Dashboard widgets and aggregate counts are intentionally withheld until ticket A02."
      />
      <section className="admin-overview-note" aria-label="Overview readiness">
        <h2>No fabricated metrics</h2>
        <p>
          Gross marketplace value, queue counts and readiness widgets will load
          from a single authorized admin-summary query in A02. This shell only
          establishes navigation, identity and security boundaries.
        </p>
      </section>
    </>
  );
}
