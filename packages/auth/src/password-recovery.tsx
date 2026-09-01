"use client";

import { createFadenBrowserClient } from "@faden/supabase";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

export function ForgotPasswordPanel() {
  const supabase = useMemo(() => createFadenBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/update-password")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    setBusy(false);
    if (error?.status === 429) {
      setMessage("Please wait before requesting another recovery email.");
      return;
    }
    setMessage(
      "If an account exists for that address, a secure recovery link has been sent.",
    );
  }

  return (
    <div className="auth-card">
      <div className="auth-card__intro">
        <p className="eyebrow">Account recovery</p>
        <h1>Reset your password.</h1>
        <p>We’ll email a one-time recovery link to your verified address.</p>
      </div>
      <form className="form-stack" onSubmit={requestReset}>
        <label>
          Email address
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <button className="button button--primary button--full" disabled={busy}>
          {busy ? "Sending…" : "Send recovery link"}
        </button>
      </form>
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
      <a className="auth-inline-link" href="/auth/sign-in">
        Back to sign in
      </a>
    </div>
  );
}

export function UpdatePasswordPanel() {
  const router = useRouter();
  const supabase = useMemo(() => createFadenBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Checking your recovery link…");

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setReady(Boolean(data.user));
      setMessage(
        data.user
          ? "Choose a new password for your FADEN account."
          : "This recovery link is invalid or has expired. Request a new link.",
      );
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setMessage("The passwords do not match.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    router.replace("/account");
    router.refresh();
  }

  return (
    <div className="auth-card">
      <div className="auth-card__intro">
        <p className="eyebrow">Account recovery</p>
        <h1>Create a new password.</h1>
        <p>{message}</p>
      </div>
      {ready ? (
        <form className="form-stack" onSubmit={updatePassword}>
          <label>
            New password
            <input
              autoComplete="new-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <label>
            Confirm new password
            <input
              autoComplete="new-password"
              minLength={8}
              onChange={(event) => setConfirmation(event.target.value)}
              required
              type="password"
              value={confirmation}
            />
          </label>
          <button
            className="button button--primary button--full"
            disabled={busy}
          >
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      ) : (
        <a
          className="button button--ghost button--full"
          href="/auth/forgot-password"
        >
          Request another link
        </a>
      )}
    </div>
  );
}
