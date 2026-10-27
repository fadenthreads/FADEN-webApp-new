import { AuthPanel, safeNextPath } from "@faden/auth";

export default async function AdminSignIn({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; auth_error?: string }>;
}) {
  const parameters = await searchParams;
  const nextPath = safeNextPath(parameters.next, "/");

  return (
    <main className="auth-page auth-page--admin">
      <a className="faden-wordmark auth-wordmark" href="/">
        FADEN / ADMIN
      </a>
      <AuthPanel
        oauthError={parameters.auth_error === "oauth_callback_failed"}
        appName="Platform Admin"
        googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true"}
        localDemo={false}
        nextPath={nextPath}
        passwordRecoveryHref={`${process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3000"}/auth/forgot-password`}
        phoneEnabled={process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === "true"}
      />
      {process.env.NODE_ENV !== "production" && (
        <div className="credential-note">
          <strong>Demo admin</strong>
          <span>admin@faden.local</span>
          <span>FadenAdmin!2026</span>
          <small>MFA enrollment is required after sign-in.</small>
        </div>
      )}
    </main>
  );
}
