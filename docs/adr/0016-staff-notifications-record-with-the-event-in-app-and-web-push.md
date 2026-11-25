---
status: accepted
date: 2026-11-24
decision-makers: owner
---

# ADR-0016: Staff notifications are a record written with the event, shown in the app by polling and pushed to browsers with Web Push after the response; the daily summary runs on Vercel Cron; native push waits for a native build

## Context and Problem Statement

Spec 002 asks that staff hear about a customer's request at once and that the owner gets the next
day's baking summary when orders close — in the app and on their devices (FR-001–FR-016). The app runs
as serverless functions on Vercel Hobby (ADR-0013, research R28 of spec 001): no long-lived process,
no connection held open, and cron at most once a day, anywhere within its hour. The staff app is used
mostly in the browser; push in the native app needs a development or store build — Expo Go does not
receive push notifications since SDK 53. How do notifications get created, stored and delivered so
that none is lost silently (constitution III), within those limits?

## Decision Drivers

- Constitution III: no silent failure — a notification that could not be delivered must still exist
  and be counted.
- Constitution I and V: personal data stays out of anything that leaves our systems (FR-010).
- Standard over invention; free licences; free tiers (constitution, ADR-0015).
- Vercel Hobby: cron at most once a day, within an hour; no background worker
  ([Vercel cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing), read
  2026-11-24).
- Expo SDK 58: remote push is not available in Expo Go, a development build is required
  ([Expo notifications, SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/notifications.md), read
  2026-11-24).
- Reviewers try the staff app in the browser (ADR-0014, R28).

## Considered Options

Creation and storage:

- A1 — a `notification` row per recipient, written in the same transaction as the event (a
  transactional record, the outbox pattern without a separate dispatcher)
- A2 — create notifications after the event, outside its transaction
- A3 — a hosted notification service (Knock, Novu, OneSignal) owns the records

In-app delivery:

- B1 — the app polls a list endpoint while open (TanStack Query `refetchInterval`)
- B2 — a realtime channel (WebSocket, server-sent events, a hosted realtime service)

Device delivery, stage 1:

- C1 — Web Push (W3C Push API, VAPID, RFC 8030/8292) from our server with the `web-push` library;
  a Service Worker in the staff web build
- C2 — Firebase Cloud Messaging for the web
- C3 — device notifications only later, with the native app

Sending:

- D1 — send right after the response (`after()`), record each attempt; the record in the app is the
  fallback
- D2 — a queue with retries (Upstash QStash, a separate worker)

## Decision Outcome

Chosen (owner, 2026-11-24): **A1 + B1 + C1 + D1**, the daily summary on **Vercel Cron**, and **Expo
push through `expo-server-sdk` later** (stage 3, with the native build), reusing the same device table.

- **A1** because it is the only option where "the event is saved" implies "its notifications exist"
  (FR-001); a crash between two steps cannot leave a request without its notification. A unique key
  per subject and person makes creation idempotent (FR-002, FR-005).
- **B1** because serverless functions cannot hold connections, and a 30-second delay meets SC-001 for
  the in-app path; polling only while the app is visible keeps the invocations well inside the free
  tier.
- **C1** because Web Push is a web standard that works in Chrome, Edge, Firefox and installed web apps
  on iOS 16.4+, needs no third-party account beyond the browsers' own push services, and the reviewers
  can see it live in the browser. `web-push` (MPL-2.0, a free licence; file-level copyleft that does
  not extend to our code) is the established Node implementation.
- **D1** because a queue is another service and account for a bakery's volume; if a send fails, the
  notification is still in the app and the failure is counted on "Provoz" (FR-011, SC-006). Delivery
  is best-effort, the record is not.
- **The daily summary** runs once a day in the hour after the cut-off; a key per day and recipient makes
  a second run harmless (FR-005).

### Consequences

- Good, because nothing depends on delivery: every notification is in the database first.
- Good, because no new service or account: our database, our functions, the browsers' push services.
- Good, because device notifications can be demonstrated in a browser without a native build.
- Bad, because a failed push is not retried; the person sees it in the app instead. If measured
  delivery failures matter, a retry path is a new decision.
- Bad, because iPhone and iPad need the app on the home screen for Web Push; the app has to explain it
  (FR-013).
- Bad, because the daily summary can arrive anywhere within the hour after the cut-off.
- Bad, because polling costs a request every 30 seconds per open app.

### Confirmation

- Integration tests on PostgreSQL: a request and its notifications commit together; handling a request
  reads them for everyone; two summary runs create one summary; a 404/410 from the push service
  removes the device; no push text contains a name, phone or order contents.
- A live push in Chrome on the deployed app, recorded in the feature's research.

## Pros and Cons of the Options

### A2 — after the event

- Bad, because a failure between the two writes loses a notification silently (constitution III).

### A3 — hosted notification service

- Good, because preferences, digests and retries come ready.
- Bad, because staff and customer data leave our systems, another account and free tier, and a vendor
  for a small feature.

### B2 — realtime channel

- Good, because instant.
- Bad, because serverless functions cannot hold the connection; it needs a hosted realtime service.

### C2 — Firebase Cloud Messaging for the web

- Good, because the same service could later serve native apps.
- Bad, because a Google project and SDK in the staff app for what the Push API does natively; Expo
  push already covers native later.

### C3 — devices only with the native app

- Bad, because the reviewers could not see device notifications at all.

### D2 — queue with retries

- Good, because failed sends are retried.
- Bad, because another service and account; the in-app record already guarantees nothing is lost.

## More Information

- Spec: `specs/002-staff-notifications/spec.md`; plan and research in the same folder.
- Web Push: [RFC 8030](https://www.rfc-editor.org/rfc/rfc8030), VAPID
  [RFC 8292](https://www.rfc-editor.org/rfc/rfc8292); `web-push` 4.0.0 (npm, MPL-2.0, read 2026-11-24).
- Related: ADR-0008 (minimal data), ADR-0013 (operations), ADR-0014 (demo access), ADR-0015 (roles).
- Re-examine after one week of use: the polling interval, delivery failures counted on "Provoz".
- **Amended 2026-11-25** (owner): new orders notify staff and appear as a banner while the app is
  open (spec 002 FR-020–FR-026); polling is every 10 s instead of 30 s. The owner confirmed polling
  for the demo and B2 (a hosted realtime channel) as the production path; reasoning and trade-offs
  in `specs/002-staff-notifications/research.md` N14 and N16. Choosing the service will be its own ADR.
