# Tasks: Notifications for the bakery's staff

**Input**: `spec.md`, `plan.md`, `research.md` (N1–N11), `data-model.md`, `contracts/http-api.md`, ADR-0016.
**Tests**: behaviour tests for every rule and route; the fix-revert rule of the constitution applies.

## Phase 1: Core and data (blocks everything)

- [x] N001 [P] Core rules `packages/core/src/notifications.ts` + tests: kinds, default preferences per role, recipients by permission, quiet hours in Prague across midnight, push texts without personal data, the summary text (FR-002, FR-004, FR-010, FR-014, FR-015; N6, N7)
- [x] N002 [P] Contracts `packages/core/src/contracts/notifications.ts`: list, read, settings, subscription, summary result (contracts/http-api.md)
- [x] N003 Schema + migration: `notification`, `notification_preference`, `notification_quiet_hours`, `push_subscription`, enums, unique `(recipient_id, subject)` (data-model.md)
- [x] N004 Repository `packages/db/src/notifications.repo.ts` + tests on PostgreSQL: create for recipients (idempotent), list + unread, read one / all / by subject, preferences and quiet hours, devices, pending deliveries, record attempt, failures count (FR-001–FR-003, FR-005, FR-011, FR-014–FR-016)

## Phase 2: User Story 1 — requests (P1)

- [x] N005 [US1] `createStaffRequest` writes the request and its notifications in one transaction; `setStaffRequestDone(true)` reads them for everyone (FR-001–FR-003; N1–N3)
- [x] N006 [US1] Delivery `apps/web/server/notifications/{push,deliver}.ts`: `web-push` with VAPID, preferences + quiet hours, 404/410 removes the device, attempts recorded; scheduled with `after()` from the call tool and call end routes; off and logged once without VAPID keys (FR-009–FR-011; N9, N10)
- [x] N007 [US1] `GET /api/staff/notifications`, `PATCH /api/staff/notifications/{id}`, `POST /api/staff/notifications/read-all` + tests (FR-007, FR-008)
- [x] N008 [US1] Staff app: bell with unread count in the header (polling 30 s while visible), "Upozornění" screen: list, open = read + navigate, mark all read; gone subject says so (FR-007, FR-008; N4, N11)

## Phase 3: User Story 2 — daily summary (P1)

- [x] N009 [US2] `apps/web/server/notifications/summary.ts` + `GET /api/cron/plan-summary` (cron secret) + Vercel cron: next open day, order count, top three to bake, zero orders still sent, once per day and recipient; tests (FR-004, FR-005; N8)

## Phase 4: User Story 3 — settings and devices (P2)

- [x] N010 [US3] `GET/PUT /api/staff/notification-settings`, `POST/DELETE /api/staff/push-subscriptions` (test notification on register) + tests (FR-009, FR-012, FR-014, FR-015)
- [x] N011 [US3] Service Worker `apps/staff/public/sw.js` (show, click opens the link) and a web app manifest; verify it is served at `/staff/sw.js` (N5)
- [x] N012 [US3] Staff app settings: kinds × (in app, device), quiet hours, "Zapnout upozornění v tomto zařízení" with permission, test, iPhone home-screen hint; sign-out unregisters this device (FR-009, FR-012–FR-015)

## Phase 5: Operations and retention

- [x] N013 [P] "Provoz": push failures in the period; retention deletes notifications after 30 days (FR-011, FR-016, SC-006)

## Phase 6: User Story 4 — stage 2 (P3)

- [x] N014 [US4] Near-limit warning to the owner once per product and day at 90% (proposed) on order save (FR-017)
- [x] N015 [US4] Plan changed: an order added for a day whose summary went out tells the other staff (FR-018)
- [x] N016 [US4] Assistant down: a failed call start tells the owner at most once an hour, also in quiet hours (FR-019)

## Phase 6b: User Story 5 — every new order and the banner (P1, amended 2026-11-25)

- [x] N018 [US5] Core: kind `new_order` (permission `order:view`, default on for both roles), its device text without personal data, subject `order:<id>`; schema enum + migration; tests (FR-020, FR-025; N12)
- [x] N019 [US5] `insertOrder` notifies every staff member except the author, in the order's transaction; phone, web and staff paths schedule delivery; tests (FR-020; N12)
- [x] N020 [US5] Staff app: polling 10 s; `NotificationBanner` in the layout — slide in, 30 s, slide out, ×, stack of three + count, no replay of older ones; tests (FR-007, FR-021, FR-024; N13, N14)
- [x] N021 [US5] Banner details for `new_order` from the order endpoint; tap reads and opens; tests (FR-022; N13)
- [x] N022 [US5] Sound: Web Audio chime, unlock on first click, per-device switch + test button in settings, silent in quiet hours; tests (FR-023; N15)
- [x] N023 [US5] Service Worker: on push with a visible window, post to it instead of a system notification; verify in Chrome (FR-026; N14)
- [x] N024 [US5] Quickstart rows 12–16 and a live run with two accounts (SC-007, SC-008) _(owner's live run 2026-11-25: banners by polling in both accounts; push path not switched on — research N16)_

## Phase 6c: Fixes from the code review (2026-11-25; research N18)

- [x] N025 Push registration: HTTPS at a known push service only, 10 s send timeout, 10 registrations per person per hour; tests incl. a private address (FR-027)
- [x] N026 Plan notifications link `/plan?day=`; the plan screen reads the day from the address; tests (FR-028)

## Phase 7: Verification

- [ ] N017 _(automated part done 2026-11-24: 247 tests, `next build`, staff export; the live run with VAPID keys is the owner's)_ Quickstart 1–9 locally; live push in Chrome on the deployment; record in `research.md`; README section (SC-001–SC-006)

## Dependencies

N001–N004 first; N005–N008 (US1) before N010–N012 (devices need delivery); N009 after N004; N013 after
N006; N014–N016 after stage 1; N017 last. VAPID keys (owner) before N006 can push for real.
