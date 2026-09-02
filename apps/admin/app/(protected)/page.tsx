import {
  getPaymentsReadiness,
  getShippingReadiness,
  getEmailReadiness,
  getDailyReadiness,
  toPublicReadiness,
} from "@faden/integrations";

import { AdminMetricCard } from "../../components/admin-metric-card";
import { AdminReadinessCard } from "../../components/admin-readiness-card";
import { AdminActivityItem } from "../../components/admin-activity-item";
import { AdminIcon } from "../../components/admin-icon";
import { requireAdminSession } from "../../lib/admin-session";
import {
  formatCurrency,
  formatCount,
  formatTimeRange,
} from "../../lib/format.mjs";

type DashboardSummary = {
  time_range_days: number;
  generated_at: string;
  gmv_paise: number;
  active_orders_count: number;
  pending_verification_count: number;
  open_disputes_count: number;
  settlements_awaiting_count: number;
  recent_activity: Array<{
    id: number;
    created_at: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    actor_id: string | null;
    reason: string | null;
  }>;
};

async function getDashboardSummary(
  supabase: Awaited<ReturnType<typeof requireAdminSession>>["supabase"],
): Promise<DashboardSummary | null> {
  try {
    const { data, error } = await supabase.rpc("admin_dashboard_summary");

    if (error) {
      console.error("Failed to fetch admin dashboard summary:", error);
      return null;
    }

    return data as unknown as DashboardSummary;
  } catch (err) {
    console.error("Unexpected error fetching dashboard summary:", err);
    return null;
  }
}

export default async function AdminOverviewPage() {
  const { supabase } = await requireAdminSession();
  const summary = await getDashboardSummary(supabase);

  const paymentsReadiness = toPublicReadiness(getPaymentsReadiness());
  const shippingReadiness = toPublicReadiness(getShippingReadiness());
  const emailReadiness = toPublicReadiness(getEmailReadiness());
  const dailyReadiness = toPublicReadiness(getDailyReadiness());

  if (!summary) {
    return (
      <div className="admin-overview-error">
        <AdminIcon name="error" />
        <div className="admin-overview-error__message">
          <p>
            <strong>Unable to load platform metrics</strong>
          </p>
          <p>
            The dashboard summary could not be retrieved. Check your permissions
            and try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  const hasActivity = summary.recent_activity.length > 0;
  const hasAnyData =
    summary.gmv_paise > 0 ||
    summary.active_orders_count > 0 ||
    summary.pending_verification_count > 0 ||
    summary.open_disputes_count > 0 ||
    summary.settlements_awaiting_count > 0;

  return (
    <div className="admin-overview-grid">
      <div className="admin-overview-metrics">
        <AdminMetricCard
          label={`GMV · ${formatTimeRange(summary.time_range_days)}`}
          value={formatCurrency(summary.gmv_paise)}
          icon="trending_up"
        />
        <AdminMetricCard
          label="Active Orders"
          value={formatCount(summary.active_orders_count)}
          icon="shopping_bag"
        />
        <AdminMetricCard
          label="Pending Verifications"
          value={formatCount(summary.pending_verification_count)}
          icon="verified_user"
          trend={
            summary.pending_verification_count > 0 ? "Needs attention" : ""
          }
        />
        <AdminMetricCard
          label="Open Disputes"
          value={formatCount(summary.open_disputes_count)}
          icon="gavel"
        />
        <AdminMetricCard
          label="Settlements Awaiting"
          value={formatCount(summary.settlements_awaiting_count)}
          icon="account_balance"
        />
      </div>

      <section
        className="admin-overview-section"
        aria-label="Integration status"
      >
        <div className="admin-overview-section__header">
          <h2 className="admin-overview-section__title">
            Integration Readiness
          </h2>
        </div>
        <div className="admin-overview-section__body">
          {!hasAnyData && (
            <div className="admin-overview-empty">
              <AdminIcon name="info" />
              <p className="admin-overview-empty__title">
                No operational data yet
              </p>
              <p className="admin-overview-empty__description">
                Metric cards and activity will populate as platform operations
                begin. Integration status reflects current server configuration.
              </p>
            </div>
          )}
          <div className="admin-readiness-grid">
            <AdminReadinessCard readiness={paymentsReadiness} />
            <AdminReadinessCard readiness={shippingReadiness} />
            <AdminReadinessCard readiness={emailReadiness} />
            <AdminReadinessCard readiness={dailyReadiness} />
          </div>
        </div>
      </section>

      <section
        className="admin-overview-section"
        aria-label="Recent platform activity"
      >
        <div className="admin-overview-section__header">
          <h2 className="admin-overview-section__title">
            Recent Platform Activity
          </h2>
        </div>
        {hasActivity ? (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-activity-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Event Type</th>
                  <th>Entity / Subject</th>
                </tr>
              </thead>
              <tbody>
                {summary.recent_activity.map((activity) => (
                  <AdminActivityItem key={activity.id} activity={activity} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-overview-section__body">
            <div className="admin-overview-empty">
              <AdminIcon name="history" />
              <p className="admin-overview-empty__title">No recent activity</p>
              <p className="admin-overview-empty__description">
                Auditable platform events will appear here. Only significant
                actions requiring AAL2 authorization are recorded.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
