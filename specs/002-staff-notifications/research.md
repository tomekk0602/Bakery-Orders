# Research: Notifications for the bakery's staff

Decisions inside feature 002. Cross-feature decisions are in ADR-0016.

## N1 — Where notifications come from and when they exist

- **Decision**: a `notification` row per recipient is inserted in the same transaction as the event —
  inside `createStaffRequest` (used by the `request_staff` tool and by the end-of-call check) and
  inside the daily summary job. Recipients are resolved in that transaction from the staff accounts
  and their permissions.
- **Rationale**: FR-001 — an event saved without its notification would be a silent failure.
- **Alternatives rejected**: a database trigger — logic out of TypeScript and out of the tests' reach;
  writing after the commit — can be lost (ADR-0016 A2).

## N2 — One notification per subject and person

- **Decision**: `dedupe_key` is `request:<id>` or `summary:<day>`, unique together with the recipient.
  Inserts use "on conflict do nothing".
- **Rationale**: FR-002, FR-005; the end-of-call check and the tool could both record a request; the
  cron can run twice.

## N3 — Handling a request reads its notifications for everyone

- **Decision**: `setStaffRequestDone(id, true)` sets `read_at` on every unread notification with
  `subject = request:<id>` in the same transaction; reopening a request does not unread them (FR-003).
  A device notification not yet sent for a handled request is not sent (edge case).

## N4 — In-app delivery: polling while visible

- **Decision**: TanStack Query `refetchInterval: 30_000` on the unread count and the list,
  `refetchIntervalInBackground: false`, refetch on focus (the defaults of the library).
- **Rationale**: SC-001/SC-002 at 30 s; serverless cannot hold connections (ADR-0016 B1). One open app
  is ~2,900 requests a day — far inside the free tier.
- **Debt**: 30 s is proposed, unmeasured; revisit after a week.

## N5 — Web Push in the staff web build

- **Decision**: a Service Worker at `apps/staff/public/sw.js`. Expo's web export copies `public/` to the
  output root, which the deployment serves under `/staff`, so it is `/staff/sw.js` with scope
  `/staff/` — the staff app only. Subscription with the server's VAPID public key
  (`applicationServerKey`), `userVisibleOnly: true`. The worker shows the notification and on click
  focuses an open staff tab or opens the link.
- **To verify in implementation**: that `expo export` with `baseUrl` `/staff` copies `public/sw.js` to
  `public/staff/sw.js`, and that the Next.js rewrite of `/staff/*` serves the file itself (static files
  win over rewrites).
- **Verified 2026-11-24**: `expo export` copies `public/sw.js` and `public/manifest.webmanifest` to
  `apps/web/public/staff/`; the production build serves them as files (the `/staff/*` rewrite applies
  only after the file system). In development Metro serves them at `/sw.js`.
- **Amended 2026-11-24 (implementation)**: the payload `link` is an app path (`/pozadavky`), and the
  worker resolves it against its own scope. A fixed `/staff/…` would break in development, where the app
  has no `/staff` prefix. The single-page build has no HTML template of ours, so the app adds the
  `<link rel="manifest">` at start.
- **iPhone/iPad**: Web Push only in a web app added to the home screen (iOS 16.4+). Detected by
  `navigator.standalone` / `display-mode: standalone`; otherwise the app explains it (FR-013). A web
  app manifest is needed for "Add to Home Screen" to install it as an app.

## N6 — The push payload

- **Decision**: `{ title, body, link, tag }` — title and body from a fixed Czech text per kind, without
  personal data (FR-010): e.g. "Nový požadavek: zavolat zpět", "Plán na středu 25. 11.: 34 objednávek".
  `tag` = the dedupe key, so a repeated push replaces the earlier one on the device.
- **Rationale**: the lock screen is public; details appear only in the signed-in app.
- **Test**: every kind's text is checked against the subject's customer name and phone.

## N7 — Quiet hours

- **Decision**: per person `quiet_from`/`quiet_to` as local times, default 20:00–04:00, evaluated in
  Europe/Prague on the date of sending; a range that crosses midnight is quiet when the time is after
  `from` or before `to`. Notifications created during quiet hours are not pushed later (they are in
  the app); exception: the owner's assistant-down alert (stage 2, FR-019).
- **Rationale**: a push at 4:30 for a request from 22:00 helps nobody; the app shows it.

## N8 — The daily summary

- **Decision**: `GET /api/cron/plan-summary`, Vercel Cron daily at 13:00 UTC (14:00–15:00 Prague in
  winter, 15:00–16:00 in summer — Vercel cron is UTC; acceptable within the "up to an hour late"
  assumption). The job takes the next open day after today (the same rule as the plan screen), runs
  `planForDay`, and creates one notification per recipient with `summary:<day>`. Recipients: the owner
  role, plus employees who switched the kind on. Zero orders still produce a summary.
- **Debt**: the cut-off time is the owner's setting; the cron time is fixed in `vercel.json`. If the
  owner changes the cut-off, the cron does not follow — said in the settings screen; revisit if it
  matters.

## N9 — Removing devices

- **Decision**: a 404 or 410 from the push service deletes the registration (permanent); other errors
  increment a failure counter and are recorded on the notification (`push_error`). Sign-out
  unsubscribes in the browser and deletes the registration on the server (FR-012).

## N10 — Sending after the response

- **Decision**: routes that create notifications call `after(() => deliverPending(...))`, which sends
  the device notifications of those rows (respecting preferences and quiet hours) and records
  `push_sent_at` or `push_error`. The cron job sends its own summaries the same way.
- **Rationale**: no worker on Hobby (ADR-0016 D1); the in-app record is the fallback.
- **Amended 2026-11-24 (implementation)**: the cron job awaits its own delivery before it answers —
  nobody waits on it, and `after()` adds nothing there. With the VAPID keys unset, nothing is scheduled.
  `web-push` is imported as a namespace (`import * as`): it is CommonJS without a default export, and
  the production bundler refuses a default import (found by `next build`).

## N11 — Texts and deep links

- **Decision**: all user-visible texts in `cs.json` (staff app) and in the core's push texts (Czech);
  links are app paths: `/staff/pozadavky?id=<id>`, `/staff/plan?day=<date>`. Opening a notification
  whose subject is gone (after "Reset demo") says "Tato položka už neexistuje".
- **Amended 2026-11-24 (implementation)**: links open the screen, not the item — `/pozadavky`, `/plan`,
  `/nastaveni`, `/provoz`. Neither screen takes an id or a day from the address yet, and the screens
  already show the item first (open requests oldest first, the plan for the next open day). A subject
  that is gone therefore needs no message: the screen no longer lists it. Opening a single item is
  left for when a screen can show one request.

## N12 — Every new order (amended 2026-11-25, FR-020, FR-025)

- **Decision**: a new kind `new_order`, permission `order:view` (both roles), default in the app and on
  devices for both. Created inside the order's transaction, in the same place as the near-limit warning
  (`insertOrder`), for every channel; `except` = the staff member who entered it. Subject
  `order:<id>`; link `/objednavka/<id>` (the existing order detail screen). Device text: title "Nová
  objednávka", body "Na <weekday> <d. M.>, <channel>." — no name, no items (FR-010).
- **Alternatives rejected**: a notification only for phone orders (the owner wants all); grouping
  orders into one notification per minute (the banner shows each order's details, so each is its own).

## N13 — The banner (FR-021, FR-022, FR-024)

- **Decision**: one `NotificationBanner` component mounted once in the staff layout, above the tabs,
  in React Native (works on the web build and in the native app). It watches the same notification
  query as the bell. At start it remembers the newest `createdAt` it has seen; every unread notification
  newer than that, not yet shown, becomes a banner — so opening the app does not replay older ones
  (FR-024). Animation with React Native's `Animated` (slide in from the top, 30 s, slide out); no new
  library. At most three visible, newest on top, the rest counted.
- **Order details**: a `new_order` banner loads `GET /api/staff/orders/:id` (exists, `order:view`) and
  shows number, name, pickup day, items, total and channel; until it loads it shows the title and text.
  Other kinds show title and text.
- **Tap**: marks the notification read (`PATCH /api/staff/notifications/:id`) and navigates to its link;
  × closes it only.

## N14 — Faster arrival (FR-007 amended, FR-021, FR-026)

- **Decision**: the notification list polls every 10 s while the app is visible (was 30 s; TanStack Query
  pauses it in the background). On a device with device notifications on, the Service Worker, on a push,
  looks for a visible window of the app: if there is one, it posts the payload to that window, which
  refetches the list at once (the banner then shows), and shows no system notification; otherwise it
  shows the system notification as before.
- **To verify in implementation**: Chrome requires `userVisibleOnly` subscriptions to show a
  notification per push, but exempts a push while a page of the origin is visible. If that turns out
  false, the worker shows the system notification and closes it at once when a window is visible.
- **Cost**: 10 s polling keeps the database awake while the app is open; on Neon that is compute time
  during opening hours only. Accepted for the demo; revisit with the owner (assumption in spec).

## N15 — Sound (FR-023)

- **Decision**: a short two-tone chime synthesized with the Web Audio API (`AudioContext`, two
  oscillators, ~0.4 s) — no audio file, no library. One shared `AudioContext`, resumed on the first
  click anywhere (browsers block sound before a user gesture). The per-device switch "Zvuk" lives in
  the browser's local storage, default on; "Přehrát zkušební zvuk" plays it and unlocks the context.
  No sound during the person's quiet hours (read from the settings query).
- **Native app**: no sound until the native build adds `expo-audio`; the banner still shows.
- **Alternatives rejected**: an MP3 asset (a file to license and ship for one beep); storing the sound
  switch on the server (it is a property of the device — the office PC beeps, the phone in a pocket
  might not).

## N16 — Polling in the demo, a realtime channel in production (owner, 2026-11-25)

- **Observed 2026-11-25** (owner's test, two staff accounts, local): two web orders and two requests
  became banners in both open apps; the server log shows the app asking every 10 s (75 list reads in
  the session) and no device registered for push, so every banner came from polling. Up to 10 s
  between the order and the banner; the owner accepted it for the demo.
- **Decision**: the demo keeps polling every 10 s as the way banners arrive, with Web Push as the
  instant path on devices where it is switched on (N14). No realtime channel is added.
- **Why not a realtime channel now**: the app runs as serverless functions on Vercel, which cannot hold
  a WebSocket open, and each request may run in a different instance from the one that saved the order.
  The Node equivalents of SignalR (Socket.IO, `ws`) need a long-running server. Server-Sent Events on
  Vercel would hold a function and a database connection per open tab, be cut at the function's
  maximum duration and need Postgres `LISTEN/NOTIFY` between instances — more moving parts than the
  demo is worth. Polling needs nothing new and is the fallback any realtime design keeps anyway.
- **In production**: a hosted realtime service (Pusher, Ably or Supabase Realtime, to be chosen in an
  ADR with current prices and terms) — after the order's transaction commits, the server publishes a
  signal carrying no personal data ("new notification"), and the open apps read the list at once.
  Alternatively a small long-running Socket.IO service beside Vercel. Either way the notification
  stays a database record (ADR-0016), polling drops to a slow fallback (e.g. 60 s) and Web Push stays
  for closed apps and phones.
- **Cost of polling**: about 6 requests a minute per open app, each a few milliseconds; on Neon it keeps
  the database awake while the app is open. Fine for a demo with a few staff; a reason to switch when
  the bakery's own tablets stay open all day.

## N17 — Routes without a tab bounced to "Dnes" (fixed 2026-11-25)

- **Observed** (owner): tapping 🔔 showed `/upozorneni` for a moment and jumped to `/dnes`. A router test
  reproduced it, and showed the order detail of spec 001 (`/objednavka/:id`, FR-012) bounced the same way.
- **Cause**: since Expo Router 58, `href: null` marks a tab screen hidden, and navigating to a hidden
  screen redirects to the first tab (`TabsClient`, "new redirect behavior").
- **Fix**: such routes keep a screen but no tab button (`tabBarButton: () => null`, item `display:
none`); only the redirecting `index` keeps `href: null`. Regression test
  `apps/staff/src/features/navigation/__tests__/HiddenRoutes.test.tsx` fails without the fix.
- **Follow-up 2026-11-25** (owner): "‹ Zpět" on those routes raised "GO_BACK was not handled". The tabs
  now keep history (`backBehavior="history"`), so back returns to the tab the person came from; with no
  history (opened from a link or a device notification) it goes to "Dnes". Both cases are in the same
  regression test and fail without the fix.

## N18 — Fixes from the code review of 2026-11-25

- **Push endpoints (FR-027)**: a subscription's endpoint must be `https:` on a host of a known push
  service — `fcm.googleapis.com` (Chrome, Edge on Android), `*.notify.windows.com` (Edge on Windows),
  `updates.push.services.mozilla.com` (Firefox), `*.push.apple.com` (Safari). Anything else is refused
  (400) before it is stored, so the test push can never be aimed at a private or internal address
  (SSRF). `web-push` sends with a 10 s timeout. Registrations: at most 10 per person per hour, with the
  existing rate-limit table. Confirmed by the review: `z.url()` accepted `https://127.0.0.1:8443/…`.
- **Plan links (FR-028)**: plan notifications link to `/plan?day=<YYYY-MM-DD>`, and the plan screen
  takes the day from the address. This reverses the part of N11's 2026-11-24 amendment about the plan:
  a summary sent in the afternoon and opened the next morning showed the plan of the day after.
  Request notifications keep `/pozadavky`.
