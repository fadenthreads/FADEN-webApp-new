import { AuthPanel } from "@faden/auth";

export default async function StudioSignIn({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const parameters = await searchParams;
  const nextPath = parameters.next?.startsWith("/") ? parameters.next : "/";

  return (
    <main className="auth-page auth-page--studio">
      <a className="faden-wordmark auth-wordmark" href="/">
        FADEN / STUDIO
      </a>
      <AuthPanel
        appName="Boutique Studio"
        googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true"}
        localDemo={process.env.NODE_ENV !== "production"}
        nextPath={nextPath}
        passwordRecoveryHref={`${process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3000"}/auth/forgot-password`}
        phoneEnabled={
          process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === "true" ||
          process.env.NODE_ENV !== "production"
        }
      />
      {process.env.NODE_ENV !== "production" && (
        <div className="credential-note">
          <strong>Demo owner</strong>
          <span>owner@faden.local</span>
          <span>FadenOwner!2026</span>
        </div>
      )}
    </main>
  );
}
