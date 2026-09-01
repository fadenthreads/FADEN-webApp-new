"use client";
import Script from "next/script";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
type CheckoutResult = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};
type RazorpayInstance = {
  open: () => void;
  on: (event: string, callback: () => void) => void;
};
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}
export function PaymentControls({
  orderId,
  available,
  status,
  amount,
  webhookReady,
}: {
  orderId: string;
  available: boolean;
  status: string;
  amount: number;
  webhookReady: boolean;
}) {
  const router = useRouter(),
    [ready, setReady] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function call(action: string, fields: Record<string, unknown> = {}) {
    const response = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, orderId, ...fields }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Payment status is unavailable.");
    return data;
  }
  async function refresh() {
    setBusy(true);
    try {
      const data = await call("refresh");
      setMessage(
        data.status === "captured"
          ? "Test advance verified. No real money was collected."
          : data.status === "authorized"
            ? "Payment authorized, awaiting capture. Do not pay again. Check auto-capture in your Razorpay test dashboard."
            : "No captured payment confirmed. You may retry using this same checkout.",
      );
      router.refresh();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not refresh payment status.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (status === "cancelled")
    return (
      <p className="offer-notice">
        This order is cancelled. No checkout is available.
      </p>
    );
  if (status === "test_advance_paid")
    return (
      <section className="offer-panel">
        <h2>Test advance verified</h2>
        <p>No real money was collected. This does not authorize production.</p>
        <Link className="offer-btn" href={`/orders/${orderId}/receipt`}>
          View test receipt →
        </Link>
      </section>
    );
  if (!available || amount < 100)
    return (
      <p className="offer-notice">
        {amount < 100
          ? "Online test checkout requires an advance of at least ₹1. A zero advance is not payment confirmation."
          : "Razorpay test checkout setup pending. Live payments remain disabled."}
      </p>
    );
  return (
    <div>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onReady={() => setReady(true)}
        onError={() =>
          setMessage(
            "Could not load Razorpay. Check your connection and reload. No payment has been started.",
          )
        }
      />
      <p className="offer-notice">
        <strong>Test mode only.</strong> No real money will be collected. Do not
        enter real card details. Production and balance collection remain
        disabled.
      </p>
      {!webhookReady && (
        <p className="offer-notice">
          Automatic webhook updates are not configured yet. If checkout closes
          or confirmation is delayed, return here and refresh payment status
          before retrying.
        </p>
      )}
      <label className="offer-check">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I approve opening Razorpay test checkout for this saved advance. I
        understand self-service cancellation is unavailable once checkout
        starts, including after a failed or dismissed attempt.
      </label>
      <button
        className="offer-btn"
        disabled={!confirmed || busy || !ready}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const data = await call("start", { confirmed: true });
            if (data.status === "captured") {
              router.refresh();
              setBusy(false);
              return;
            }
            if (!window.Razorpay)
              throw new Error(
                "Razorpay is not ready. Reload and retry the same order.",
              );
            const checkout = new window.Razorpay({
              key: data.key,
              order_id: data.order_id,
              amount: data.amount,
              currency: data.currency,
              name: "FADEN · Test checkout",
              description: "Test advance — no real money",
              theme: { color: "#94452e" },
              modal: {
                ondismiss: () => {
                  setBusy(false);
                  setMessage(
                    "Checkout closed. Refresh payment status before retrying.",
                  );
                },
              },
              handler: async (result: CheckoutResult) => {
                try {
                  const verified = await call("verify", {
                    paymentId: result.razorpay_payment_id,
                    providerOrderId: result.razorpay_order_id,
                    signature: result.razorpay_signature,
                  });
                  setMessage(
                    verified.status === "captured"
                      ? "Test advance verified."
                      : "Awaiting captured-payment confirmation. Do not pay again; refresh the status.",
                  );
                  router.refresh();
                } catch (e) {
                  setMessage(
                    e instanceof Error
                      ? e.message
                      : "Verification pending. Do not pay again; refresh status.",
                  );
                } finally {
                  setBusy(false);
                }
              },
            });
            checkout.on("payment.failed", () => {
              setBusy(false);
              setMessage(
                "Razorpay reported a failed attempt. Refresh status before retrying; the same order will be reused.",
              );
            });
            checkout.open();
          } catch (e) {
            setMessage(
              e instanceof Error ? e.message : "Unable to open checkout.",
            );
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Checking payment…"
          : !ready
            ? "Loading test checkout…"
            : "Pay test advance →"}
      </button>
      <div className="offer-actions">
        <button
          className="offer-btn secondary"
          disabled={busy}
          onClick={refresh}
        >
          Refresh payment status
        </button>
      </div>
      {message && (
        <p role="status" className="offer-notice">
          {message}
        </p>
      )}
    </div>
  );
}
