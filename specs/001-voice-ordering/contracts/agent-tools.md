# Contract: agent tools

The tools a model may call — the Live agent on a call, the cascade fallback, and the staff dictation
model. Defined once in `packages/core/src/agent/tools.ts` as zod schemas, exported to JSON Schema for
the providers, and validated again on the server before the core runs (ADR-0003, ADR-0010). The
catalogue is in the instructions (research R5, adopted with ADR-0010); there is no `list_products`.

Every tool result is JSON. Errors are results with `ok: false` and a `reason` from a closed set, so
the model can say what happened instead of guessing.

## prepare_order

- **Description given to the model** (Czech in the prompt; English here): Prepares an order for the
  customer's confirmation and returns the lines and the total. Does not save it. Do not call until the
  customer has clearly named every product. If a word does not match a product in the offer, or you
  did not understand it, do not infer a product — ask.
- **Arguments**

| Field | Schema |
|---|---|
| items | array (1–20) of `{ product_id: enum<active product ids>, quantity: integer 1–200 }` |
| pickup_date | string `YYYY-MM-DD` |
| customer_name | string 1–80 |

- **Server checks**: ids active; day open and in the 14-day window; cut-off (skipped in staff mode with
  a staff session); remaining capacity per line (informational — the binding check is at confirm).
- **Result**: `{ ok: true, draft_id, lines: [{ name, quantity, unit_price_czk, subtotal_czk }], total_czk, pickup_date, pickup_weekday }`
  or `{ ok: false, reason: "closed_day" | "past_day" | "after_cutoff" | "over_limit" | "unknown_product", detail }`.

## confirm_order

- **Description**: Saves the last prepared order. Call only after the customer has explicitly agreed
  to the read-back.
- **Arguments**: `{ draft_id: string }`
- **Server checks**: the draft exists, is unexpired and belongs to this call or staff session;
  capacity updated in one transaction (R14).
- **Result**: `{ ok: true, order_number }` or `{ ok: false, reason: "no_draft" | "over_limit" | "after_cutoff" | "closed_day" }`.

## request_staff

- **Description**: Records a request for a person from the bakery: a callback, a change or a
  cancellation of an existing order. Use when the customer asks for a person, wants to change or
  cancel an order, or when you have not understood twice in a row.
- **Arguments**: `{ kind: "callback" | "change" | "cancel", customer_name?: string, note: string }`
- **Server**: the caller's phone comes from the call record, not from the model (FR-035).
- **Result**: `{ ok: true }`.

## Call-end check (server, not a tool)

At `POST /api/call/{id}/end` the server scans the agent's own turns for a callback promise (word list
versioned with the prompt, unmeasured — research R3) and creates a `staff_request` with origin
`promised_not_recorded` when none exists for the call (FR-008).

## Modes

| Mode | Who | Differences |
|---|---|---|
| customer (Live or cascade) | caller | greeting with the AI notice; cut-off enforced; phone from the call record |
| staff (dictation) | staff, logged in | third-person sentence, no greeting; cut-off override; phone optional; `confirm_order` is not offered to the model — staff confirm in the UI |

## Versioning

`packages/core/src/agent/` holds `prompt.cs.md`, `tools.ts`, `vocabulary.ts` and `VERSION`. A change
to any of them bumps the version; the version is written on every order and trace (FR-030) and the
eval gate compares against the baseline of the previous version (ADR-0012).
