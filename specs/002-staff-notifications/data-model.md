# Data model: Notifications for the bakery's staff

Four new tables in the same PostgreSQL database, one migration. Times are `timestamptz`; days `date`.

## `notification`

One message for one staff member about one subject.

| Column       | Type                                                                                                      | Notes                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| id           | uuid pk                                                                                                   |                                                                                   |
| recipient_id | text → `user.id`, on delete cascade                                                                       | a staff account                                                                   |
| kind         | enum `request` · `plan_summary` · `new_order` (stage 2: `near_limit` · `plan_changed` · `assistant_down`) |                                                                                   |
| subject      | text                                                                                                      | `request:<uuid>` · `summary:<YYYY-MM-DD>` — what it is about, also the dedupe key |
| title        | text                                                                                                      | Czech, no personal data (FR-010)                                                  |
| body         | text                                                                                                      | Czech, no personal data                                                           |
| link         | text                                                                                                      | app path opened on tap                                                            |
| in_app       | boolean                                                                                                   | listed in the app: the recipient's preference when it was created (FR-014)        |
| push         | boolean                                                                                                   | sent to devices: the recipient's preference when it was created                   |
| created_at   | timestamptz default now()                                                                                 |                                                                                   |
| read_at      | timestamptz null                                                                                          | set on open, "mark all", or when the request is handled                           |
| push_sent_at | timestamptz null                                                                                          | first successful device delivery                                                  |
| push_error   | text null                                                                                                 | last delivery error, for "Provoz" (FR-011)                                        |

- A person who switched a kind off in the app and on devices gets no row at all. _(Added 2026-11-24
  in implementation: the preference is copied onto the row, so a later change does not rewrite history.)_
- **Unique** `(recipient_id, subject)` — one notification per subject and person (FR-002, FR-005).
- **Index** `(recipient_id, read_at, created_at desc)` — the list and the unread count.
- **Retention**: deleted 30 days after `created_at` by the nightly retention job (FR-016).

## `notification_preference`

| Column  | Type                                | Notes |
| ------- | ----------------------------------- | ----- |
| user_id | text → `user.id`, on delete cascade |       |
| kind    | same enum                           |       |
| in_app  | boolean                             |       |
| push    | boolean                             |       |

- **Primary key** `(user_id, kind)`. A missing row means the default (FR-014): `request` — in app and
  push for everyone; `plan_summary` — owner on, employee off.

## `notification_quiet_hours`

| Column     | Type                                   | Notes                     |
| ---------- | -------------------------------------- | ------------------------- |
| user_id    | text pk → `user.id`, on delete cascade |                           |
| quiet_from | time                                   | default 20:00 when no row |
| quiet_to   | time                                   | default 04:00 when no row |
| enabled    | boolean                                |                           |

Kept apart from preferences: one row per person, not per kind.

## `push_subscription`

A device that agreed to receive notifications for a staff member.

| Column          | Type                                | Notes                                                           |
| --------------- | ----------------------------------- | --------------------------------------------------------------- |
| id              | uuid pk                             |                                                                 |
| user_id         | text → `user.id`, on delete cascade |                                                                 |
| channel         | enum `web` (stage 3: `expo`)        |                                                                 |
| endpoint        | text, unique                        | the push service URL (web) — identifies the device registration |
| p256dh          | text                                | the browser's public key (web)                                  |
| auth            | text                                | the browser's auth secret (web)                                 |
| user_agent      | text null                           | shown to the person to recognise the device                     |
| created_at      | timestamptz default now()           |                                                                 |
| last_success_at | timestamptz null                    |                                                                 |
| failures        | integer default 0                   | consecutive non-permanent failures                              |

- Deleted on 404/410 from the push service, on sign-out of that device, or when the person turns the
  device off (FR-011, FR-012).
- `endpoint` + keys identify a browser profile, not a person: they are not sent anywhere else and are
  removed with the account.

## Changes to existing tables

None. `staff_request` and `order` are unchanged; notifications reference them through `subject`.

## Amendment 2026-11-25

- Enum `notification_kind` gains `new_order` (FR-020): one migration, `ALTER TYPE … ADD VALUE`.
- No new table: the sound switch of FR-023 is per device and lives in the browser's local storage
  (research N15).
