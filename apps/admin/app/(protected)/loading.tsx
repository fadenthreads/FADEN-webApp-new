import { AdminIcon } from "../../components/admin-icon";

export default function AdminOverviewLoading() {
  return (
    <div className="admin-overview-loading" role="status" aria-live="polite">
      <AdminIcon name="progress_activity" />
      <span>Loading platform overview…</span>
    </div>
  );
}
