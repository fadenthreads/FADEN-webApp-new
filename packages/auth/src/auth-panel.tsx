"use client";

import { createFadenBrowserClient } from "@faden/supabase";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

type AuthMode = "email" | "phone";

interface AuthPanelProps {
  appName: string;
  googleEnabled?: boolean;
  initialAction?: "sign-in" | "sign-up";
  localDemo?: boolean;
  nextPath: string;
  passwordRecoveryHref?: string;
  phoneEnabled?: boolean;
}

export function AuthPanel({
  appName,
  googleEnabled = false,
  initialAction = "sign-in",
  localDemo = false,
  nextPath,
  passwordRecoveryHref,
  phoneEnabled = false,
}: AuthPanelProps) {
  const router = useRouter();
  const supabase = useMemo(() => createFadenBrowserClient(), []);
  const [mode, setMode] = useState<AuthMode>("email");
  const [action, setAction] = useState(initialAction);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState(localDemo ? "+919999999999" : "+91");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function continueToApp() {
    router.push(nextPath);
    router.refresh();
  }

  async function handleGoogle() {
    if (!googleEnabled) {
      setMessage(
        "Google sign-in is implemented but disabled locally until OAuth credentials are configured.",
      );
      return;
    }

    setBusy(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) setMessage(error.message);
    setBusy(false);
  }

  async function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const result =
      action === "sign-up"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: displayName } },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (result.data.session) continueToApp();
    else setMessage("Check your email to confirm your account.");
  }

  async function handlePhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    if (!otpSent) {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      setBusy(false);
      if (error) setMessage(error.message);
      else {
        setOtpSent(true);
        setMessage("Verification code sent.");
      }
      return;
    }

    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: "sms",
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else continueToApp();
  }

  return (
    <div className="auth-card">
      <div className="auth-card__intro">
        <p className="eyebrow">Secure access</p>
        <h1>
          {action === "sign-in" ? "Welcome back." : "Create your account."}
        </h1>
        <p>
          Continue to {appName} with a verified email
          {phoneEnabled ? ", mobile number," : ""} or Google identity.
        </p>
      </div>

      <button
        className="button button--google button--full"
        disabled={busy}
        onClick={handleGoogle}
        type="button"
      >
        <span aria-hidden="true">G</span> Continue with Google
      </button>
      {!googleEnabled && (
        <p className="field-hint">
          OAuth credentials are required to enable Google locally.
        </p>
      )}

      <div className="auth-divider">
        <span>or</span>
      </div>

      {phoneEnabled && (
        <div className="segmented-control" aria-label="Authentication method">
          <button
            className={mode === "email" ? "is-active" : ""}
            onClick={() => setMode("email")}
            type="button"
          >
            Email
          </button>
          <button
            className={mode === "phone" ? "is-active" : ""}
            onClick={() => setMode("phone")}
            type="button"
          >
            Phone OTP
          </button>
        </div>
      )}

      {!phoneEnabled || mode === "email" ? (
        <form className="form-stack" onSubmit={handleEmail}>
          {action === "sign-up" && (
            <label>
              Full name
              <input
                autoComplete="name"
                onChange={(event) => setDisplayName(event.target.value)}
                required
                value={displayName}
              />
            </label>
          )}
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
          <label>
            Password
            <input
              autoComplete={
                action === "sign-in" ? "current-password" : "new-password"
              }
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <button
            className="button button--primary button--full"
            disabled={busy}
          >
            {busy
              ? "Please wait…"
              : action === "sign-in"
                ? "Sign in"
                : "Create account"}
          </button>
          {action === "sign-in" && passwordRecoveryHref && (
            <a className="auth-inline-link" href={passwordRecoveryHref}>
              Forgot your password?
            </a>
          )}
        </form>
      ) : (
        <form className="form-stack" onSubmit={handlePhone}>
          <label>
            Mobile number
            <input
              autoComplete="tel"
              disabled={otpSent}
              onChange={(event) => setPhone(event.target.value)}
              pattern="^\+[1-9][0-9]{7,14}$"
              required
              type="tel"
              value={phone}
            />
          </label>
          {otpSent && (
            <label>
              Six-digit code
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setOtp(event.target.value)}
                required
                value={otp}
              />
            </label>
          )}
          <button
            className="button button--primary button--full"
            disabled={busy}
          >
            {busy
              ? "Please wait…"
              : otpSent
                ? "Verify and continue"
                : "Send code"}
          </button>
          {otpSent && (
            <button
              className="text-button"
              onClick={() => setOtpSent(false)}
              type="button"
            >
              Use a different number
            </button>
          )}
        </form>
      )}

      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}

      <button
        className="auth-switch"
        onClick={() => setAction(action === "sign-in" ? "sign-up" : "sign-in")}
        type="button"
      >
        {action === "sign-in"
          ? "New to FADEN? Create an account"
          : "Already registered? Sign in"}
      </button>

      {localDemo && phoneEnabled && (
        <div className="demo-note">
          <strong>Local testing</strong>
          <span>Phone: +919999999999 · OTP: 123456</span>
        </div>
      )}
    </div>
  );
}
