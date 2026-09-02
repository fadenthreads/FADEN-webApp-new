import type { ReactNode } from "react";

export function AdminPlaceholder({
  ticket,
  title,
  description,
  children,
}: {
  ticket: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section
      className="admin-placeholder"
      aria-labelledby="admin-placeholder-title"
    >
      <div className="admin-placeholder__badge">Ticket {ticket}</div>
      <h2 id="admin-placeholder-title">{title}</h2>
      <p className="admin-placeholder__lead">{description}</p>
      <div className="admin-placeholder__panel">
        <p>
          This route is protected and intentionally shows no operational data
          until ticket <strong>{ticket}</strong> ships. Counts, tables and
          actions will load from authorized server queries only.
        </p>
        {children}
      </div>
    </section>
  );
}
