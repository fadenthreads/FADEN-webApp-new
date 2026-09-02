import { AdminIcon } from "./admin-icon";

export function AdminMetricCard({
  label,
  value,
  icon,
  trend,
}: {
  label: string;
  value: string;
  icon: string;
  trend?: string;
}) {
  return (
    <div className="admin-metric-card">
      <div className="admin-metric-card__header">
        <span className="admin-metric-card__label">{label}</span>
        <AdminIcon name={icon} />
      </div>
      <div className="admin-metric-card__value-row">
        <span className="admin-metric-card__value">{value}</span>
        {trend && <span className="admin-metric-card__trend">{trend}</span>}
      </div>
    </div>
  );
}
