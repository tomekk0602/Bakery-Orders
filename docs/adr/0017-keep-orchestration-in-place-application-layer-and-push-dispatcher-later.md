---
status: accepted
date: 2026-11-25
decision-makers: owner
---

# ADR-0017: Keep the orchestration where it is for now; an application layer and a push dispatcher come later

## Context and Problem Statement

A second outside review (2026-11-25) proposed six architecture changes: an application layer of use
cases, one prepare → confirm flow for every channel, the agent as an adapter, an explicit call
lifecycle, one refresh strategy in the staff app, and a durable push dispatcher. Each was checked
against the code before the hand-over of the demo (spec 001 research R36).

## Decision Drivers

- Real guarantees for the bakery first: no double order, the price the customer saw, the order
  number always shown.
- No large move of working code just before hand-over: a refactor without a new guarantee is risk
  without benefit for the reviewer or the bakery.
- Every change goes spec first (constitution of the repository, AGENTS.md).

## Considered Options

- A — do all six now
- B — do the ones that close real gaps now; record the rest as the target with its reason
- C — do none before hand-over

## Decision Outcome

Chosen option: **B**.

Now (spec 001 FR-064–FR-066, spec 002 FR-029):

- **One prepare → confirm flow** for phone, web and staff, and the same answer on a retried
  confirmation — the only proposal that closes real defects (a second order on a retry; a price the
  customer did not see).
- **The call result always reaches the screen** — the one real gap left in the call lifecycle after
  spec 001 T107; a full state machine adds nothing the `ended` flag and the shared release do not.
- **The remaining refresh dependency** (closing a request → the bell).

Later, with the reason:

- **Application layer** (`prepareOrder`, `confirmOrder`, `cancelOrder`, … in one place instead of
  `packages/db` and `apps/web/server`): clearer, but no behaviour changes; worth it when a second
  team member or a second front end arrives. Until then `packages/db` keeps `runCallTool` and the
  order transaction with its notifications.
- **Agent as an adapter**: already true in substance — the browser holds the Gemini connection,
  `runCallTool` translates tool calls into the same core rules and repositories as the form; a real
  phone number replaces only the connection layer. Renaming adds nothing.
- **Durable push dispatcher** (a table of attempts with retries, run by a scheduled job): only when
  the bakery relies on push during work; ADR-0016's record-first design already keeps every
  notification in the app.

### Consequences

- Good, because the demo gains guarantees a reviewer can test (double submit, cap-ended call) without
  a risky move of code.
- Bad, because `packages/db` still holds some orchestration; a reader must know it from this ADR.

### Confirmation

Tests for FR-064–FR-066 and 002 FR-029; this ADR is re-examined when a second front end or a second
developer joins, or when push becomes part of the bakery's daily work.

## Pros and Cons of the Options

### A — all six now

- Good, because the structure would match the reviewer's picture.
- Bad, because it moves most of the backend days before hand-over, with regressions likely and no
  new guarantee from three of the six.

### C — none

- Good, because nothing changes before hand-over.
- Bad, because a double "Potvrdit" can save two orders and a capped call hides its order number.

## More Information

- Spec 001 research R35 (first review) and R36 (this one); ADR-0016 (notifications); ADR-0009 (three
  channels, one core).
