import Link from "next/link";
import { AppointmentPanel } from "@faden/ui";
import { atelierContext } from "../../lib/atelier";
import { AtelierShell } from "../../components/atelier-shell";
export default async function Appointments({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; page?: string }>;
}) {
  const { supabase, user, boutiques } = await atelierContext();
  const search = await searchParams;
  const view = ["upcoming", "history"].includes(search.view ?? "")
    ? search.view!
    : "pending";
  const page = Math.max(
    1,
    Math.min(1000, Number.parseInt(search.page ?? "1", 10) || 1),
  );
  const now = new Date().toISOString();
  let query = supabase
    .from("measurement_appointments")
    .select("*", { count: "exact" })
    .eq("owner_id", user.id);
  if (view === "pending")
    query = query
      .eq("status", "confirmed")
      .lte("ends_at", now)
      .order("ends_at");
  else if (view === "upcoming")
    query = query
      .eq("status", "confirmed")
      .gt("ends_at", now)
      .order("starts_at");
  else
    query = query
      .neq("status", "confirmed")
      .order("created_at", { ascending: false });
  const [
    { data: slots, error },
    { data: appointments, error: bookingError, count },
  ] = await Promise.all([
    supabase
      .from("appointment_slots")
      .select()
      .eq("owner_id", user.id)
      .neq("state", "withdrawn")
      .gte("starts_at", now)
      .order("starts_at")
      .limit(100),
    query.order("id").range((page - 1) * 20, page * 20 - 1),
  ]);
  if (error || bookingError)
    throw new Error("Could not load your appointment schedule.");
  const href = (v: string, p = 1) => `/appointments?view=${v}&page=${p}`;
  return (
    <AtelierShell active="appointments">
      <nav className="appointment-tabs" aria-label="Appointment views">
        {(
          [
            ["pending", "Awaiting outcome"],
            ["upcoming", "Upcoming / in progress"],
            ["history", "History"],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={href(value)}
            aria-current={view === value ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <p>
        {view === "pending"
          ? "Sessions that have ended and need an outcome."
          : view === "history"
            ? "Completed, no-show, cancelled and rescheduled preview sessions."
            : "Confirmed sessions that have not ended yet."}{" "}
        Outcomes never update measurements, payments or send reminders.
      </p>
      <AppointmentPanel
        slots={slots ?? []}
        appointments={(appointments ?? []).map((a) => ({
          ...a,
          state: "booked",
        }))}
        boutiques={boutiques}
      />
      <nav className="appointment-tabs" aria-label="Booking pages">
        {page > 1 && <Link href={href(view, page - 1)}>Previous page</Link>}
        <span>
          Page {page} · {count ?? 0} bookings in this view
        </span>
        {page * 20 < (count ?? 0) && (
          <Link href={href(view, page + 1)}>Next page</Link>
        )}
      </nav>
      <p>
        Availability shows up to 100 future slots. Booking views show 20
        sessions per page.
      </p>
    </AtelierShell>
  );
}
