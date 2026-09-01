import { AuthPanel } from "@faden/auth";

export default async function AdminSignIn({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const parameters = await searchParams;
  const nextPath = parameters.next?.startsWith("/") ? parameters.next : "/";

  return (
    <main className="auth-page auth-page--admin">
      <a className="faden-wordmark auth-wordmark" href="/">
        FADEN / ADMIN
      </a>
      <AuthPanel
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
