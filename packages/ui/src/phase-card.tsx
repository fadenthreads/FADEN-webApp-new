interface PhaseCardProps {
  eyebrow: string;
  title: string;
  body: string;
  status?: "ready" | "next";
}

export function PhaseCard({
  eyebrow,
  title,
  body,
  status = "ready",
}: PhaseCardProps) {
  return (
    <article className="phase-card">
      <div className="phase-card__topline">
        <span>{eyebrow}</span>
        <span className={`status-pill status-pill--${status}`}>
          {status === "ready" ? "Ready" : "Next"}
        </span>
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}
