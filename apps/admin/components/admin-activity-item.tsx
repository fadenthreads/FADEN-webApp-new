import { formatRelativeTime } from "../lib/format.mjs";
import { AdminIcon } from "./admin-icon";

type AuditActivity = {
  id: number;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_id: string | null;
  reason: string | null;
};

function getActivityIcon(action: string): string {
  if (action.includes("payment") || action.includes("capture"))
    return "payments";
  if (action.includes("refund")) return "undo";
  if (action.includes("boutique")) return "storefront";
  if (action.includes("verification")) return "verified_user";
  if (action.includes("dispute")) return "gavel";
  if (action.includes("settlement") || action.includes("payout"))
    return "account_balance";
  if (action.includes("order")) return "shopping_bag";
  if (action.includes("role")) return "admin_panel_settings";
  if (action.includes("config")) return "settings";
  return "history";
}

function getActivityLabel(action: string): string {
  const parts = action.split(".");
  if (parts.length >= 2) {
    const [entity, verb] = parts;
    return `${entity} ${verb}`.replace(/_/g, " ");
  }
  return action.replace(/_/g, " ");
}

export function AdminActivityItem({ activity }: { activity: AuditActivity }) {
  const icon = getActivityIcon(activity.action);
  const label = getActivityLabel(activity.action);
  const timeLabel = formatRelativeTime(activity.created_at);

  return (
    <tr className="admin-activity-row">
      <td className="admin-activity-cell admin-activity-cell--time">
        {timeLabel}
      </td>
      <td className="admin-activity-cell admin-activity-cell--type">
        <span className="admin-activity-badge">
          <AdminIcon name={icon} />
          <span>{label}</span>
        </span>
      </td>
      <td className="admin-activity-cell admin-activity-cell--entity">
        {activity.entity_type && (
          <>
            <span className="admin-activity-entity-type">
              {activity.entity_type}
            </span>
            {activity.entity_id && (
              <span className="admin-activity-entity-id">
                {activity.entity_id}
              </span>
            )}
          </>
        )}
        {activity.reason && (
          <span className="admin-activity-reason">{activity.reason}</span>
        )}
      </td>
    </tr>
  );
}
