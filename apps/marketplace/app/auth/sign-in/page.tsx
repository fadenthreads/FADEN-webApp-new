import { AuthPanel } from "@faden/auth";

export default async function MarketplaceSignIn({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const parameters = await searchParams;
  const nextPath = parameters.next?.startsWith("/")
    ? parameters.next
    : "/account";

  return (
    <main className="auth-page">
      <a className="faden-wordmark auth-wordmark" href="/">
        FADEN
      </a>
      <AuthPanel
        appName="your FADEN account"
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
