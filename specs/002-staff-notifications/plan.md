# Implementation Plan: Notifications for the bakery's staff

**Branch**: `002-staff-notifications` (work on `main`, as in 001) | **Date**: 2026-11-24 | **Spec**:
[spec.md](spec.md)

**Input**: Feature specification from `specs/002-staff-notifications/spec.md`; decision ADR-0016.

## Summary

Staff learn about customers' requests at once and the owner gets the next day's baking summary when
orders close (stage 1: US1–US3). A `notification` row per recipient is written in the same
transaction as the event that causes it; the staff app polls a list while it is open and shows a bell
with a counter; device notifications use Web Push from our server after the response, to devices the
person registered; the daily summary is a Vercel Cron job with a key per day and recipient. Stage 2
(US4: limit warning, plan changed, assistant down) reuses the same record and delivery. Native push
(Expo) is out of scope until a native build exists (ADR-0016).

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 24 (as 001)

**Primary Dependencies**: Next.js 16 (API, `after()`), Drizzle ORM + PostgreSQL, Better Auth (session,
permissions), Expo Router + TanStack Query (staff app), zod contracts in `@bakery/core`. New:
`web-push` 4.0.0 (MPL-2.0) on the server; the browser's Push API and a Service Worker in the staff
web build (no library).

**Storage**: PostgreSQL (Neon in production); four new tables, one migration (`data-model.md`).

**Testing**: Vitest with Testcontainers PostgreSQL (repositories, routes, cron); jest-expo + RNTL
(staff UI); `web-push` replaced at the module boundary in tests; one manual live push in Chrome on
the deployment, recorded in `research.md`.

**Target Platform**: Vercel (fra1) for the API; the staff app in browsers (Chrome/Edge/Firefox;
iPhone/iPad as a home-screen web app, iOS 16.4+); Expo Go keeps in-app notifications only.

**Project Type**: web application + mobile/web staff app in one monorepo (as 001).

**Performance Goals**: a request visible in every open app within 30 s (polling interval, proposed)
and on devices within 1 min (SC-001); list endpoint p95 under 300 ms (proposed, unmeasured).

**Constraints**: serverless — no long-lived connection, no background worker; Vercel Hobby cron at
most once a day within an hour; no personal data in push payloads (FR-010); free tiers only.

**Scale/Scope**: one bakery, 2–10 staff accounts, tens of requests and one summary a day, 4 tables,
7 endpoints, 2 staff screens, 1 Service Worker.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle / rule                                  | How this plan satisfies it                                                                                                                   | Status              |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| I. The model chooses, the code decides            | No model involved; recipients, texts and timing are code                                                                                     | pass                |
| II. Nothing invented, nothing saved without a yes | Notifications only report saved events; summary numbers come from the same plan function                                                     | pass                |
| III. No silent failure                            | Notification written with the event (FR-001); failed sends recorded and counted on "Provoz" (FR-011); summary goes out even with zero orders | pass                |
| IV. Measure before choosing                       | Polling 30 s and warning 90% marked as proposed; live push measured once and recorded                                                        | pass (debts listed) |
| V. Keep little, keep it briefly                   | No names, phones or order contents in pushes; notifications deleted after 30 days; registrations removed on sign-out and refusal             | pass                |
| VI. No paid tokens                                | No model, no paid service; browsers' push services are free                                                                                  | pass                |
| VII. Only from the specs                          | Spec 002 + ADR-0016 first; tasks cite FRs                                                                                                    | pass                |
| Standard over invention                           | Web Push (W3C, RFC 8030/8292), `web-push`, Service Worker API, Vercel Cron, TanStack Query polling                                           | pass                |
| Limits live in the database                       | Uniqueness of a notification per subject and person is a database constraint                                                                 | pass                |
| Secrets                                           | VAPID keys created and entered by the owner; never in the repository                                                                         | pass                |

Re-check after Phase 1: no violations; nothing in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-staff-notifications/
├── spec.md
├── plan.md              # this file
├── research.md          # Phase 0: decisions inside the feature
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1: how to verify
├── contracts/
│   └── http-api.md      # Phase 1: endpoints and payloads
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/core/src/
├── notifications.ts             # kinds, defaults, recipients rule, quiet hours, push text (pure, tested)
└── contracts/notifications.ts   # zod: list, settings, subscription, summary payload

packages/db/src/
├── schema.ts                    # + notification, notification_preference, notification_quiet_hours, push_subscription
├── notifications.repo.ts        # create-with-event helpers, list, read, read-for-subject, prefs, devices
├── calls.repo.ts / call-tools.ts# createStaffRequest also writes the request's notifications (same tx)
├── requests.repo.ts             # setStaffRequestDone also reads the request's notifications
└── retention.repo.ts            # + notifications older than 30 days

apps/web/
├── server/notifications/
│   ├── push.ts                  # web-push sender (VAPID), 404/410 → remove device, record attempts
│   ├── deliver.ts               # after(): pending device notifications → push, respecting quiet hours
│   └── summary.ts               # daily summary for the next open day (uses planForDay)
├── app/api/staff/notifications/ (route.ts, [id]/route.ts, read-all/route.ts)
├── app/api/staff/notification-settings/route.ts
├── app/api/staff/push-subscriptions/route.ts
├── app/api/cron/plan-summary/route.ts
└── vercel.json                  # + cron for the summary after the cut-off

apps/staff/
├── public/sw.js                 # Service Worker: show push, open the link on click
├── src/features/notifications/
│   ├── api.ts                   # queries (polling), mutations
│   ├── NotificationBell.tsx     # header bell + unread count
│   ├── NotificationsScreen.tsx  # list, open = read + navigate, mark all read
│   ├── NotificationSettings.tsx # kinds × (app, device), quiet hours, this device on/off
│   └── device.ts                # Push API: permission, subscribe/unsubscribe, iOS home-screen check
└── app/(app)/upozorneni.tsx     # route for the list (+ settings section)
```

**Structure Decision**: the same monorepo layout as 001. Rules that do not touch I/O (who gets what,
quiet hours, the push text) go to `packages/core`, so they are tested without a database and reused
by the summary job and the routes. Delivery lives in `apps/web/server/notifications`. The staff app
gets one feature folder.

## Phase 0: Research

Decisions inside the feature are in [research.md](research.md): polling while visible; the Service
Worker path and scope under `/staff`; the push payload; quiet hours in Prague time across midnight;
the summary's schedule and key; device removal on 404/410; deep links; reading a request's
notifications on handling; texts in Czech. No open questions remain.

## Phase 1: Design

- [data-model.md](data-model.md): four tables, keys and constraints, retention.
- [contracts/http-api.md](contracts/http-api.md): seven endpoints and the push payload.
- [quickstart.md](quickstart.md): how to verify each user story locally and on the deployment.

## Delivery order (input for tasks)

1. Core rules + contracts + migration + repositories, tested (FR-001–FR-006, FR-014–FR-016).
2. Request events write notifications; handling reads them (US1 server side).
3. List/read API + bell + list screen (US1 in the app, FR-007, FR-008).
4. Settings API + screen (US3, FR-014, FR-015).
5. VAPID + subscriptions + Service Worker + sending after the response (FR-009–FR-013).
6. Daily summary cron (US2, FR-004, FR-005).
7. "Provoz": delivery failures counted (FR-011, SC-006); retention (FR-016).
8. Live check in Chrome on the deployment; research entry; README section.

Stage 2 (US4) follows after stage 1 is used for a week.

## Complexity Tracking

No constitution violations to justify.
