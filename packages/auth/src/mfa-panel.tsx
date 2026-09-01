"use client";

import { createFadenBrowserClient } from "@faden/supabase";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

interface TotpEnrollment {
  qrCode: string;
  secret: string;
}

export function MfaPanel({ nextPath = "/" }: { nextPath?: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createFadenBrowserClient(), []);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("Checking your security settings…");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function prepare() {
      const { data: assurance } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance?.currentLevel === "aal2") {
        router.replace(nextPath);
        return;
      }

      const { data: factors, error: listError } =
        await supabase.auth.mfa.listFactors();
      if (listError) {
        setMessage(listError.message);
        return;
      }

      const verified = factors.totp.find(
        (factor) => factor.status === "verified",
      );
      if (verified) {
        setFactorId(verified.id);
        setMessage("Enter the current code from your authenticator app.");
        return;
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "FADEN Admin",
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      setFactorId(data.id);
      setEnrollment({
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
      setMessage("Scan the QR code, then enter the six-digit code.");
    }

    void prepare();
  }, [nextPath, router, supabase]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      setMessage(challengeError.message);
      setBusy(false);
      return;
    }

    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      router.push(nextPath);
      router.refresh();
    }
  }

  return (
    <div className="auth-card mfa-card">
      <p className="eyebrow">Admin protection</p>
      <h1>Two-step verification.</h1>
      <p>{message}</p>
      {enrollment && (
        <div className="mfa-enrollment">
          <Image
            alt="Authenticator QR code"
            height={220}
            src={enrollment.qrCode}
            unoptimized
            width={220}
          />
          <details>
            <summary>Can’t scan the code?</summary>
            <code>{enrollment.secret}</code>
          </details>
        </div>
      )}
      {factorId && (
        <form className="form-stack" onSubmit={verify}>
          <label>
            Authenticator code
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              minLength={6}
              onChange={(event) => setCode(event.target.value)}
              required
              value={code}
            />
          </label>
          <button
            className="button button--primary button--full"
            disabled={busy}
          >
            {busy ? "Verifying…" : "Verify secure access"}
          </button>
        </form>
      )}
    </div>
  );
}
