import { ForgotPasswordPanel } from "@faden/auth";

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page">
      <a className="faden-wordmark auth-wordmark" href="/">
        FADEN
      </a>
      <ForgotPasswordPanel />
      <a className="auth-back" href="/">
        ← Back to the marketplace
      </a>
    </main>
  );
}
