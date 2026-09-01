# Measurement session integrations

## Ready in code

FADEN supports video measurement sessions and in-person boutique visits. Daily is the selected video adapter because it can create private, expiring rooms through a server API without requiring each customer to connect a Google account. Google Calendar/Meet can be added later as an optional calendar sync, not as the room authority.

The shared `@faden/integrations` package provides:

- configuration/readiness checks with two independent activation flags;
- deterministic room names derived only from the appointment UUID;
- private rooms available 15 minutes before a session until 30 minutes after it;
- participant-bound, expiring meeting tokens;
- camera and microphone off on entry;
- recording capability omitted from rooms and tokens so it remains unavailable; and
- a ten-second provider timeout with no credential or response-body leakage in errors.

Authenticated readiness endpoints exist in Marketplace and Studio at `/api/appointments/readiness`. They never return the API key or the names of missing secrets.

Protected join endpoints now exist in both applications at `/api/appointments/video`. They require a same-origin authenticated request, rely on appointment RLS and an explicit participant check, accept only confirmed video appointments, and issue access only from 15 minutes before until 30 minutes after the session. Rooms are reused by deterministic appointment ID. Participant tokens are bound to one room and user, expire with the session, eject on expiry, and are never stored. The UI shows the join control only when every activation check passes.

Migration `202609010020_appointment_session_integrations.sql` prepares server-only metadata for provider rooms and structured in-person venue snapshots. Browser roles have no direct access. Meeting tokens must be minted on demand after re-checking that the signed-in user is the appointment customer or current boutique owner; tokens must never be stored in Supabase, logs or URLs generated ahead of time.

## Deliberately disabled

Set these server-only variables in both Marketplace and Studio only when live acceptance testing begins:

```text
DAILY_API_KEY=...
DAILY_API_BASE_URL=https://api.daily.co/v1
DAILY_API_ENABLED=false
DAILY_LIVE_ROOMS_ENABLED=false
```

Both flags must be `true`, credentials must be present, and `NEXT_PUBLIC_APP_ENV` must be `production` before the adapter reports live rooms enabled. Keeping either flag false is the safe default. Do not prefix the API key with `NEXT_PUBLIC_`.

No live provider call, room, participant token, calendar event, email or SMS is created while the activation flags remain false. Before real customer activation, add cancellation revocation, audit events, rate limits, Daily webhook verification, accessibility testing of the call UI, and end-to-end tests with test accounts. Confirm the boutique venue before travel; maps/autocomplete are aids, not proof that a location is safe or open.
