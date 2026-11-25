# Contract: HTTP API for notifications

JSON over HTTPS; request and response bodies are zod schemas in
`packages/core/src/contracts/notifications.ts`. Errors: `{ error: { code, message } }` as in 001.
Every staff route requires a Better Auth session; a notification is visible only to its recipient.

## Staff

| Method & path                            | Body → response                                                                                                                                                                                                                 | Permission           | FR             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------- |
| `GET /api/staff/notifications?limit=50`  | → `{ unread: number, items: [{ id, kind, title, body, link, createdAt, readAt }] }` newest first                                                                                                                                | signed in (own only) | FR-007         |
| `PATCH /api/staff/notifications/{id}`    | `{ read: true }` → `{ ok: true }`; 404 when not the caller's                                                                                                                                                                    | signed in            | FR-008         |
| `POST /api/staff/notifications/read-all` | → `{ read: number }`                                                                                                                                                                                                            | signed in            | FR-008         |
| `GET /api/staff/notification-settings`   | → `{ kinds: [{ kind, inApp, push, allowed }], quietHours: { enabled, from: "HH:MM", to: "HH:MM" }, vapidPublicKey, devices: [{ id, userAgent, createdAt, lastSuccessAt }] }` — `allowed` false for kinds the role cannot act on | signed in            | FR-014, FR-015 |
| `PUT /api/staff/notification-settings`   | `{ kinds: [{ kind, inApp, push }], quietHours }` → same as GET; kinds the role cannot act on are refused (403)                                                                                                                  | signed in            | FR-014, FR-015 |
| `POST /api/staff/push-subscriptions`     | `{ endpoint, keys: { p256dh, auth }, userAgent? }` → `{ id }` and a test notification is sent at once; idempotent on `endpoint`                                                                                                 | signed in            | FR-009         |
| `DELETE /api/staff/push-subscriptions`   | `{ endpoint }` → `204`; also called on sign-out                                                                                                                                                                                 | signed in            | FR-012         |

## Cron

| Path                         | Purpose                                                                                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/cron/plan-summary` | daily summary for the next open day (Vercel Cron, `Authorization: Bearer $CRON_SECRET`, 503 without it) → `{ day, created: number, pushed: number }` — FR-004, FR-005 |

## Push payload (server → Service Worker)

```json
{
  "title": "Nový požadavek",
  "body": "Zákazník chce zavolat zpět.",
  "link": "/pozadavky",
  "tag": "request:…"
}
```

- `link` is an app path; the Service Worker resolves it against its scope (`/staff/` when deployed;
  research N5, amended 2026-11-24).
- No customer name, phone or order contents (FR-010). `tag` is the subject, so a repeat replaces the
  earlier device notification.
- Encrypted per RFC 8291 by `web-push`; VAPID (RFC 8292) with `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT` (`mailto:`), created and entered by the owner.

## Changes to existing routes

| Route                                                                | Change                                                                                                        |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `POST /api/call/{id}/tools/request_staff`, `POST /api/call/{id}/end` | a recorded request also writes its notifications (same transaction) and schedules delivery after the response |
| `PATCH /api/staff/requests/{id}` `{ done: true }`                    | also marks the request's notifications read for everyone                                                      |
| `GET /api/staff/provoz`                                              | + `notifications: { pushFailed: number }` over the period (FR-011, SC-006)                                    |
| `GET /api/cron/retention`                                            | + notifications older than 30 days (FR-016)                                                                   |

## Amendment 2026-11-25 (FR-020–FR-026)

- `kind` gains `new_order`; its `link` is `/objednavka/<order id>`. The banner reads the order with the
  existing `GET /api/staff/orders/{id}` (`order:view`); no new endpoint.
- Push payload for `new_order`: `{ "title": "Nová objednávka", "body": "Na čtvrtek 26. 11., web.",
"link": "/objednavka/<id>", "tag": "order:<id>" }` — no name, no items (FR-025).
- Service Worker → page message: `{ "type": "notification", "tag": "<subject>" }` posted to a visible
  window instead of a system notification (FR-026, research N14).
- `GET /api/staff/notifications` gains `quiet: boolean` — whether the caller's quiet hours are on now, so
  the banner knows to stay silent (FR-023) without the app computing Prague time itself.
