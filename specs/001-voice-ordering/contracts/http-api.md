# Contract: HTTP API of `apps/web`

JSON over HTTPS. Request and response bodies are zod schemas in `packages/core/src/contracts/`,
shared by the web app, the staff app and the tests. Errors: `{ error: { code, message } }` with a
code from a closed set; Czech `message` for screens, English `code` for logs.

## Public (no login)

| Method & path | Purpose | Body → Response | FR |
|---|---|---|---|
| `GET /api/catalogue` | products and open days for the form | → `{ products[], openDays[] }` | FR-014 |
| `POST /api/orders` | web form order | `{ customer_name, customer_phone, pickup_date, items[] }` → `{ order_number, total_czk }`; errors `closed_day`, `after_cutoff`, `over_limit`, `invalid` | FR-014, FR-040 |
| `POST /api/call/start` | begin a browser call | `{ caller_phone }` → `{ call_id, token, model, expires_at, cap_seconds }`; errors `rate_limited`, `quota_exhausted`, `voice_unavailable` | FR-035, FR-036 |
| `POST /api/call/{id}/tools/{name}` | run a tool call from the Live session | tool arguments → tool result ([agent-tools.md](agent-tools.md)) | FR-003–FR-008 |
| `POST /api/call/{id}/events` | browser telemetry | `{ type: "first_audio" \| "turn" \| "fallback" \| "error", ms?, detail? }[]` → `204` | FR-032 |
| `POST /api/call/{id}/turn` | cascade fallback: one customer turn as text | `{ text }` → `{ say, tool_results[] }` | ADR-0011 |
| `POST /api/call/{id}/end` | end the call | `{ transcript[], reason }` → `{ outcome, order_number? }` | FR-008, FR-009 |

The call routes accept only a `call_id` issued by `/start` within its cap, from the same IP hash.

## Staff (Better Auth session required)

| Method & path | Purpose | FR |
|---|---|---|
| `POST /api/auth/*` | Better Auth (sign-in, session) | FR-015 |
| `POST /api/staff/dictation` | `{ text }` → order card `{ draft_id, lines[], total_czk, pickup_date, customer_name, unmatched[]: { word, candidates[] }, missing[] }` | FR-017–FR-021 |
| `POST /api/staff/orders` | form order → draft card (same shape) | FR-017 |
| `GET /api/staff/order-form` | active products and open days for the form | FR-017 |
| `POST /api/staff/drafts/{draftId}/confirm` | save the staff member's own draft (409 when the limit is gone) | FR-013, FR-019 |
| `GET /api/staff/orders?day=` | orders with source, status, transcript link | FR-012 |
| `PATCH /api/staff/orders/{id}` | edit lines/day or status (`picked_up`, `cancelled`) | FR-012, FR-013 |
| `GET /api/staff/plan?day=` | baking plan | FR-010 |
| `GET/PUT /api/staff/settings` | cut-off, closed weekdays and days, buffers, limits | FR-011 |
| `GET /api/staff/requests` / `POST …/{id}/done` | callback, change, cancel requests; badge count | FR-041 |
| `GET /api/staff/provoz?from=&to=` | metrics | FR-033 |
| `POST /api/staff/eval-cases` | `{ call_id \| order_id }` → anonymised eval case candidate | FR-031 |
| `POST /api/staff/reset` | restore the seed | FR-042 |

## Internal

| Path | Purpose |
|---|---|
| `GET /api/cron/retention` | nightly deletion of transcripts, drafts, rate-limit rows (Vercel Cron, secret header) — FR-009 |
