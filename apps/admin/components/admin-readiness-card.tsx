import type { PublicReadiness } from "@faden/integrations";
import { getReadinessPresentation } from "../lib/admin-overview-core.mjs";
import { AdminIcon } from "./admin-icon";

export function AdminReadinessCard({
  readiness,
}: {
  readiness: PublicReadiness;
}) {
  const presentation = getReadinessPresentation(readiness);

  return (
    <div className="admin-readiness-card">
      <div className="admin-readiness-card__header">
        <span className="admin-readiness-card__provider">
          {readiness.provider.charAt(0).toUpperCase() +
            readiness.provider.slice(1)}
        </span>
        <span
          className={`admin-readiness-status admin-readiness-status--${presentation.modifier}`}
        >
          {presentation.label}
        </span>
      </div>
      <div className="admin-readiness-card__body">
        <p
          className={`admin-readiness-card__message${readiness.live ? " admin-readiness-card__message--success" : ""}`}
        >
          <AdminIcon name={presentation.icon} />
          <span>{presentation.message}</span>
        </p>
      </div>
    </div>
  );
}
