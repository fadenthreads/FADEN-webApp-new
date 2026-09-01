import { SignOutButton } from "@faden/auth";

export default function UnauthorizedPage() {
  return (
    <main className="auth-page auth-page--admin">
      <section className="auth-card">
        <p className="eyebrow">Restricted area</p>
        <h1>Admin access required.</h1>
        <p>This identity does not have permission to use the FADEN Admin.</p>
        <SignOutButton redirectTo="/auth/sign-in" />
      </section>
    </main>
  );
}
