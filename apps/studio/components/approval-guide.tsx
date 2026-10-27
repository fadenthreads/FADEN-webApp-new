import { studioApprovalRules } from "../lib/studio-capabilities.mjs";

export function ApprovalGuide() {
  return (
    <section className="offer-panel studio-approval-guide">
      <h2>What needs approval?</h2>
      <p>Business verification is separate from everyday storefront editing.</p>
      <div className="studio-approval-grid">
        {studioApprovalRules.map((rule) => (
          <article key={rule.change}>
            <h3>{rule.change}</h3>
            <strong>{rule.approval}</strong>
            <p>{rule.effect}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
