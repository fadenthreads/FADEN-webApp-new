export default function DiscoveryLoading() {
  return (
    <main className="discovery-loading" aria-busy="true" aria-live="polite">
      <span className="discovery-loading__mark" aria-hidden="true">
        F
      </span>
      <p>Curating the collection…</p>
    </main>
  );
}
