import { UpdatePasswordPanel } from "@faden/auth";

export default function UpdatePasswordPage() {
  return (
    <main className="auth-page">
      <a className="faden-wordmark auth-wordmark" href="/">
        FADEN
      </a>
      <UpdatePasswordPanel />
      <a className="auth-back" href="/">
        ← Back to the marketplace
      </a>
    </main>
  );
}
