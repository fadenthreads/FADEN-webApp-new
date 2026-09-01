"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export interface AppointmentSlot {
  id: string;
  starts_at: string;
  ends_at: string;
  kind: string;
  location: string;
  state: string;
}
export interface Appointment extends AppointmentSlot {
  status: string;
  order_id: string;
  outcome_at?: string | null;
  follow_up_of?: string | null;
}
export function appointmentTime(value: string) {
  return (
    new Date(value).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    }) + " IST"
  );
}
export function AppointmentPanel({
  slots,
  appointments,
  orderId,
  boutiques,
  videoEnabled = false,
  demo = false,
}: {
  slots: AppointmentSlot[];
  appointments: Appointment[];
  orderId?: string;
  boutiques?: { id: string; name: string }[];
  videoEnabled?: boolean;
  demo?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [kind, setKind] = useState("video");
  const [selection, setSelection] = useState("");
  const [consent, setConsent] = useState(false);
  const [commandId, setCommandId] = useState(() => crypto.randomUUID());
  const active = appointments.find((a) => a.status === "confirmed");
  const lastOutcome = appointments.find(
    (a) => a.status === "completed" || a.status === "no_show",
  );
  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setConsent(false);
      setSelection("");
      setCommandId(crypto.randomUUID());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  async function joinVideo(appointmentId: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/appointments/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId }),
      });
      const body = (await response.json()) as {
        joinUrl?: string;
        error?: string;
      };
      if (!response.ok || !body.joinUrl)
        throw new Error(body.error ?? "Video room could not be opened.");
      window.location.assign(body.joinUrl);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Video room could not be opened.",
      );
      setBusy(false);
    }
  }
  return (
    <section className="appointments">
      <header>
        <span className="offer-kicker">Your fit, thoughtfully measured</span>
        <h1>Measurement sessions</h1>
        <p>Guided online, or together at the boutique.</p>
      </header>
      <p className="design-notice">
        {demo ? "Fictional preview. " : "Staging reservations. "}Not a live
        appointment service. Private video-room support is prepared but not
        enabled. Email/SMS reminders and home visits are not connected. No
        measurements are shared or changed by booking.
      </p>
      {!boutiques && active && Date.parse(active.starts_at) <= Date.now() && (
        <p className="design-notice" role="status">
          Your current session is in progress or awaiting its outcome. Your
          boutique can record completion or a no-show after it ends, then you
          can book a follow-up.
        </p>
      )}
      {!boutiques && !active && lastOutcome && (
        <p className="design-notice">
          Ready for another fitting? Choose an available time to reserve a
          follow-up. Your earlier session stays in your private history. No
          payment or measurement changes are made.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {boutiques && !demo && (
        <form
          className="offer-panel appointment-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const start = new Date(`${f.get("start")}:00+05:30`);
            if (!Number.isFinite(start.getTime())) {
              setError("Enter a valid date and time.");
              return;
            }
            void send({
              action: "create",
              commandId,
              boutiqueId: f.get("boutique"),
              start: start.toISOString(),
              end: new Date(
                start.getTime() + Number(f.get("duration")) * 60000,
              ).toISOString(),
              kind,
              location: kind === "video" ? "" : f.get("location"),
            });
          }}
        >
          <h2>Publish availability</h2>
          <fieldset disabled={busy || !boutiques.length}>
            <label>
              Boutique
              <select name="boutique" required>
                {boutiques.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Session type
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="video">Video measurement</option>
                <option value="boutique">In-person at boutique</option>
              </select>
            </label>
            <label>
              Starts at (India time · IST)
              <input name="start" type="datetime-local" required />
            </label>
            <label>
              Duration
              <select name="duration">
                <option value="30">30 minutes</option>
                <option value="60">60 minutes</option>
              </select>
            </label>
            {kind === "boutique" && (
              <label>
                Boutique address
                <input
                  name="location"
                  required
                  minLength={10}
                  maxLength={500}
                  placeholder="Full boutique address and arrival instructions"
                />
              </label>
            )}
            <button className="offer-btn" disabled={busy}>
              Publish preview slot
            </button>
          </fieldset>
          <p>
            One schedule per boutique owner. Overlapping slots are blocked,
            including across your boutiques.
          </p>
        </form>
      )}
      <div className="appointment-grid">
        <section>
          <h2>{boutiques ? "Upcoming availability" : "Choose a session"}</h2>
          {!slots.length && (
            <p className="offer-panel">
              No available slots yet. Your boutique will publish its
              availability here.
            </p>
          )}
          <div className="appointment-slots">
            {slots.map((s) => (
              <article className="offer-panel" key={s.id}>
                <span className="offer-kicker">
                  {s.kind === "video"
                    ? "Video measurement"
                    : "In-person · Boutique"}
                </span>
                <h3>{appointmentTime(s.starts_at)}</h3>
                <p>
                  {`${Math.round((Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 60000)} minutes · ${s.state}`}
                </p>
                <p>
                  {s.kind === "video"
                    ? "Private room pending activation. Recording remains off."
                    : `${s.location} · Confirm the venue with the boutique before travelling.`}
                </p>
                {boutiques ? (
                  <button
                    className="offer-btn secondary"
                    disabled={busy || s.state !== "open" || demo}
                    onClick={() => {
                      if (
                        window.confirm("Withdraw this unbooked preview slot?")
                      )
                        void send({ action: "withdraw", slotId: s.id });
                    }}
                  >
                    Withdraw slot
                  </button>
                ) : (
                  <label className="design-confirm">
                    <input
                      type="radio"
                      name="slot"
                      checked={selection === s.id}
                      disabled={
                        busy ||
                        s.state !== "open" ||
                        demo ||
                        !!(active && Date.parse(active.starts_at) <= Date.now())
                      }
                      onChange={() => {
                        setSelection(s.id);
                        setConsent(false);
                        setCommandId(crypto.randomUUID());
                      }}
                    />
                    Choose this time
                  </label>
                )}
              </article>
            ))}
          </div>
          {!boutiques && !!slots.length && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send({
                  action: "reserve",
                  orderId,
                  slotId: selection,
                  commandId,
                  replacing: active?.id ?? null,
                  confirmed: consent,
                });
              }}
            >
              <label className="design-confirm">
                <input
                  type="checkbox"
                  required
                  disabled={demo || busy}
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                I confirm this preview reservation.{" "}
                {active
                  ? "My current appointment will be replaced only if the new slot is reserved successfully."
                  : "This does not start a video call or a real appointment."}
              </label>
              <button
                className="offer-btn"
                disabled={
                  demo ||
                  busy ||
                  !consent ||
                  !selection ||
                  !!(active && Date.parse(active.starts_at) <= Date.now())
                }
              >
                {busy
                  ? "Saving…"
                  : active
                    ? "Reschedule preview appointment"
                    : lastOutcome
                      ? "Reserve preview follow-up"
                      : "Reserve preview appointment"}
              </button>
            </form>
          )}
        </section>
        <section>
          <h2>
            {boutiques ? "Customer bookings" : "Your appointment history"}
          </h2>
          {!appointments.length && (
            <p className="offer-panel">No appointments booked yet.</p>
          )}
          {appointments.map((a) => (
            <article className="offer-panel" key={a.id}>
              <span className="offer-badge">
                Preview · {a.status === "no_show" ? "No-show" : a.status}
              </span>
              <h3>
                {a.kind === "video" ? "Video measurement" : "Boutique visit"}
              </h3>
              <p>{appointmentTime(a.starts_at)}</p>
              <p>
                {a.kind === "video"
                  ? "Private video provider prepared, but joining is not enabled yet. Recording is off."
                  : `${a.location} · This saved venue is private to the appointment participants.`}
              </p>
              <small>Order {a.order_id.slice(0, 8)}</small>
              {a.kind === "video" &&
                a.status === "confirmed" &&
                videoEnabled && (
                  <>
                    <button
                      className="offer-btn"
                      disabled={
                        busy ||
                        demo ||
                        Date.now() < Date.parse(a.starts_at) - 15 * 60_000 ||
                        Date.now() > Date.parse(a.ends_at) + 30 * 60_000
                      }
                      onClick={() => void joinVideo(a.id)}
                    >
                      {busy
                        ? "Preparing secure room…"
                        : "Join secure video call"}
                    </button>
                    <p>
                      Join access opens 15 minutes before the session and closes
                      30 minutes after.
                    </p>
                  </>
                )}
              {a.follow_up_of && (
                <p>
                  Follow-up to session{" "}
                  {appointments.some(
                    (previous) => previous.id === a.follow_up_of,
                  )
                    ? appointmentTime(
                        appointments.find(
                          (previous) => previous.id === a.follow_up_of,
                        )!.starts_at,
                      )
                    : a.follow_up_of.slice(0, 8)}
                  . Earlier history is retained.
                </p>
              )}
              {a.outcome_at && (
                <p>
                  Outcome recorded by the boutique:{" "}
                  {appointmentTime(a.outcome_at)}.
                  {a.status === "no_show" &&
                    " No fee or penalty has been applied."}
                  {a.status === "completed" &&
                    " This does not confirm measurements or payment."}
                </p>
              )}
              {a.status === "confirmed" &&
                (Date.parse(a.starts_at) > Date.now() || demo) && (
                  <button
                    className="offer-btn secondary"
                    disabled={demo || busy}
                    onClick={() => {
                      if (window.confirm("Cancel this preview appointment?"))
                        void send({
                          action: "cancel",
                          appointmentId: a.id,
                          confirmed: true,
                        });
                    }}
                  >
                    Cancel appointment
                  </button>
                )}
              {a.status === "confirmed" &&
                Date.parse(a.starts_at) <= Date.now() &&
                !demo && (
                  <p>
                    {Date.parse(a.ends_at) > Date.now()
                      ? "Session in progress — record its outcome after the end time."
                      : "Awaiting boutique outcome — completion or no-show."}
                  </p>
                )}
              {boutiques &&
                a.status === "confirmed" &&
                Date.parse(a.ends_at) <= Date.now() && (
                  <div className="appointment-actions">
                    <p>
                      Record only what happened in this preview. Outcomes are
                      final in this version.
                    </p>
                    {(["completed", "no_show"] as const).map((outcome) => (
                      <button
                        key={outcome}
                        className="offer-btn secondary"
                        disabled={demo || busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Record this preview as ${outcome === "completed" ? "completed" : "a no-show"}? This cannot be changed. It does not update measurements, payment or send a message.`,
                            )
                          )
                            void send({
                              action: "outcome",
                              appointmentId: a.id,
                              outcome,
                              confirmed: true,
                            });
                        }}
                      >
                        {outcome === "completed"
                          ? "Mark completed"
                          : "Mark no-show"}
                      </button>
                    ))}
                  </div>
                )}
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}
