# Data Model: 001 Voice ordering

One PostgreSQL database (constitution). Times are stored as `timestamptz`; pickup days as `date` in
Europe/Prague (R20). Money in whole Czech crowns (`integer`), because the catalogue has no fractions.

## Entities

### bakery_settings (one row)

| Field              | Type      | Rules                                                     |
| ------------------ | --------- | --------------------------------------------------------- |
| name               | text      | "Pekárna U Lípy" in the seed                              |
| cutoff_days_before | integer   | default 1 (FR-011)                                        |
| cutoff_time        | time      | default 14:00 — proposed, not measured (spec Assumptions) |
| closed_weekdays    | integer[] | ISO weekdays; default `{7}` (Sunday)                      |
| call_cap_seconds   | integer   | default 180 — proposed, unmeasured (ADR-0014)             |

### closed_day

| Field  | Type      | Rules                                                   |
| ------ | --------- | ------------------------------------------------------- |
| day    | date (PK) | a day the owner closes in addition to holidays (FR-038) |
| reason | text      | optional                                                |

Public holidays are not stored; they come from `date-holidays` at run time (R20).

### product

| Field        | Type         | Rules                                                             |
| ------------ | ------------ | ----------------------------------------------------------------- |
| id           | text (PK)    | stable slug, e.g. `chleb-kminovy`; becomes the tool enum (FR-024) |
| name         | text         | Czech display name                                                |
| spoken_forms | text[]       | inflected forms for the speech vocabulary (FR-026)                |
| price_czk    | integer      | > 0                                                               |
| daily_limit  | integer null | null = no limit                                                   |
| active       | boolean      | only active products are offered or enumerated                    |

### walk_in_buffer

| Field      | Type                  | Rules    |
| ---------- | --------------------- | -------- |
| product_id | FK product            |          |
| weekday    | integer 1–7           |          |
| quantity   | integer ≥ 0           | (FR-011) |
| PK         | (product_id, weekday) |          |

### daily_capacity

| Field      | Type              | Rules                                       |
| ---------- | ----------------- | ------------------------------------------- |
| product_id | FK product        |                                             |
| day        | date              |                                             |
| reserved   | integer ≥ 0       | sum of confirmed, not cancelled order lines |
| PK         | (product_id, day) |                                             |

Updated only inside the confirm/cancel/edit transaction with a conditional update (R14). The row is
created on first use (`INSERT … ON CONFLICT DO NOTHING`).

### order

| Field                  | Type                                         | Rules                                                                   |
| ---------------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| id                     | uuid (PK)                                    |                                                                         |
| number                 | integer, unique                              | short order number from a sequence, spoken and shown (FR-040)           |
| source                 | enum `phone` · `web` · `staff`               |                                                                         |
| status                 | enum `confirmed` · `picked_up` · `cancelled` |                                                                         |
| customer_name          | text                                         | required                                                                |
| customer_phone         | text null                                    | required for `phone` and `web`, optional for `staff` (FR-021)           |
| pickup_day             | date                                         | open day, not past; after the cut-off only for `staff` (FR-007, FR-013) |
| total_czk              | integer                                      | computed by the core from the lines                                     |
| prompt_version         | text null                                    | for orders taken by a model (FR-030)                                    |
| model                  | text null                                    | (FR-030)                                                                |
| call_id                | FK call null                                 | for `phone`                                                             |
| created_at, updated_at | timestamptz                                  |                                                                         |

State transitions: `confirmed → picked_up`, `confirmed → cancelled` (staff only); edits by staff only,
re-running the capacity update for the difference.

### order_line

| Field          | Type        | Rules                          |
| -------------- | ----------- | ------------------------------ |
| order_id       | FK order    |                                |
| product_id     | FK product  | must be active at confirmation |
| quantity       | integer ≥ 1 |                                |
| unit_price_czk | integer     | price at order time            |

### order_draft

| Field          | Type                           | Rules                                                      |
| -------------- | ------------------------------ | ---------------------------------------------------------- |
| id             | uuid (PK)                      |                                                            |
| channel        | enum `phone` · `staff` · `web` |                                                            |
| call_id        | FK call null                   |                                                            |
| payload        | jsonb                          | lines, day, name, phone as prepared by the core            |
| summary        | jsonb                          | lines with prices and the total, as read back              |
| expires_at     | timestamptz                    | drafts older than a day are deleted                        |
| web_token_hash | text null                      | SHA-256 of the web form's draft token (FR-064, 2026-11-25) |

`confirm` accepts only an existing, unexpired draft from the same call or staff session (FR-006,
FR-019).

### staff_request

| Field                         | Type                                           | Rules                                   |
| ----------------------------- | ---------------------------------------------- | --------------------------------------- |
| id                            | uuid (PK)                                      |                                         |
| kind                          | enum `callback` · `change` · `cancel`          | (FR-008, FR-034)                        |
| origin                        | enum `agent` · `promised_not_recorded` · `web` |                                         |
| customer_name, customer_phone | text null                                      |                                         |
| note                          | text                                           | what the agent understood               |
| call_id                       | FK call null                                   |                                         |
| done_at                       | timestamptz null                               | open requests show as a badge (FR-041)  |
| outcome                       | enum `handled` · `unreachable` null            | set with `done_at` (FR-047, 2026-11-25) |
| claimed_by                    | FK user null                                   | "Volá …" (FR-050)                       |
| claimed_until                 | timestamptz null                               | now + 5 min when a call starts          |

### call

| Field                                  | Type                                                        | Rules                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| id                                     | uuid (PK)                                                   |                                                                                                       |
| caller_phone                           | text                                                        | from the field before the call (FR-035)                                                               |
| ip_hash                                | text                                                        | salted hash, for per-IP limits; never the raw IP                                                      |
| started_at, ended_at                   | timestamptz                                                 |                                                                                                       |
| mode                                   | enum `live` · `cascade` · `cascade_paid`                    | which path served the call (ADR-0011)                                                                 |
| outcome                                | enum `order` · `request` · `abandoned` · `error` · `capped` |                                                                                                       |
| first_audio_ms_p50, first_audio_ms_max | integer null                                                | from browser events (FR-032)                                                                          |
| first_audio_ms                         | integer[] null                                              | every end-of-speech → first-audio sample of the call, for p50/p95 across calls (FR-033, research R27) |
| tokens_in, tokens_out                  | integer null                                                | from provider usage metadata                                                                          |
| shadow_cost_usd                        | numeric null                                                | (ADR-0013)                                                                                            |
| prompt_version, model                  | text                                                        |                                                                                                       |
| transcript                             | jsonb null                                                  | turns of both sides; deleted 30 days after the pickup day or the call (FR-009)                        |
| trace_id                               | text                                                        | Langfuse trace id, derived from the call id (SC-011, research R27)                                    |

### rate_limit

| Field        | Type                | Rules                                                         |
| ------------ | ------------------- | ------------------------------------------------------------- |
| key          | text                | e.g. `call:<ip_hash>`                                         |
| window_start | timestamptz         |                                                               |
| count        | integer             |                                                               |
| PK           | (key, window_start) | incremented with an upsert (ADR-0014, constitution: no Redis) |

### eval_case_candidate

| Field                            | Type             | Rules                                         |
| -------------------------------- | ---------------- | --------------------------------------------- |
| id                               | uuid             |                                               |
| source_call_id / source_order_id | FK null          |                                               |
| anonymised_transcript            | jsonb            | names and phones replaced (FR-031)            |
| expected_order                   | jsonb            | the staff-corrected order                     |
| exported_at                      | timestamptz null | moved into `packages/evals` cases by a script |

Better Auth adds its own `user`, `session`, `account`, `verification` tables through its drizzle
adapter.

## Derived views (computed by the core, not stored)

- **Calendar** for the next 14 days: date, Czech weekday, today/tomorrow/the day after, closed
  (weekday, holiday, closed_day) — R1, R20.
- **Baking plan** for a day: per active product, reserved (sum of confirmed lines that day), buffer
  (walk_in_buffer for that weekday), to bake = reserved + buffer (FR-010).
- **Provoz** metrics over a period: first-audio p50/p95, outcome shares, share of phone orders edited
  by staff (FR-033).

## Retention

| Data              | Kept                                                   | Mechanism              |
| ----------------- | ------------------------------------------------------ | ---------------------- |
| call.transcript   | 30 days after the pickup day (or the call if no order) | nightly job (ADR-0008) |
| order, order_line | for the demo's life; reset restores the seed           | "Reset demo" (FR-042)  |
| order_draft       | 1 day                                                  | nightly job            |
| rate_limit        | 1 day                                                  | nightly job            |
| Langfuse traces   | 30 days (Hobby plan)                                   | provider               |

### staff_request_event _(added 2026-11-25, FR-048–FR-052; research R33)_

| Field      | Type                                                                                            | Rules                    |
| ---------- | ----------------------------------------------------------------------------------------------- | ------------------------ |
| id         | uuid (PK)                                                                                       |                          |
| request_id | FK staff_request, on delete cascade                                                             |                          |
| user_id    | FK user null, on delete set null                                                                | who did it               |
| kind       | enum `call_started` · `unanswered` · `handled` · `unreachable` · `reopened` · `order_cancelled` |                          |
| note       | text null                                                                                       | at most 300 characters   |
| order_id   | FK order null                                                                                   | for `order_cancelled`    |
| at         | timestamptz default now()                                                                       | index `(request_id, at)` |

### staff_request — archive and retention _(added 2026-11-25, FR-053–FR-057; research R34)_

- Index `staff_request_closed (done_at, id)` for the archive's pages and the nightly clean-up.
- Retention: a closed request is deleted 30 days after `done_at`, with its `staff_request_event` rows
  (cascade). Open requests (`done_at` null) are kept.
- Permission `request:archive` (owner) in `packages/core/src/permissions.ts`.
