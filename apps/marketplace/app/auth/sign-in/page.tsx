import { AuthPanel, safeNextPath } from "@faden/auth";

export default async function MarketplaceSignIn({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    action?: string;
    auth_error?: string;
  }>;
}) {
  const parameters = await searchParams;
  const nextPath = safeNextPath(parameters.next, "/account");

  return (
    <main className="auth-page">
      <a className="faden-wordmark auth-wordmark" href="/">
        FADEN
      </a>
      <AuthPanel
        oauthError={parameters.auth_error === "oauth_callback_failed"}
        appName="your FADEN account"
        initialAction={parameters.action === "sign-up" ? "sign-up" : "sign-in"}
        googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true"}
        localDemo={process.env.NODE_ENV !== "production"}
        nextPath={nextPath}
        passwordRecoveryHref="/auth/forgot-password"
        phoneEnabled={
          process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === "true" ||
          process.env.NODE_ENV !== "production"
        }
      />
      <a className="auth-back" href="/">
        ← Back to the marketplace
      </a>
    </main>
  );
}
