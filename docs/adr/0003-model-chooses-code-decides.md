---
status: accepted
date: 2026-11-24
decision-makers: owner
---

# ADR-0003: The language model only chooses from what the code gives it; dates, prices, limits, saving and callbacks are the code's job

## Context and Problem Statement

The voice agent turns Czech speech into an order. Where does the model's responsibility end? A
wrong pickup day, a wrong price or a promised callback that nobody records each means an angry
customer at the counter — the very thing the bakery wants to avoid. The first text measurement
(2026-11-24) showed where the model fails.

## Decision Drivers

- Measured, Haiku 4.5, run 1 (`research.md` R1): products and quantities right in 10/10 cases, the
  pickup date wrong in 4/10 ("v sobotu" → Sunday 29 Nov, "pozítří" → tomorrow, "příští pondělí" →
  Saturday). In one case the model read back a total it computed itself before the tool answered.
- Measured, run 2: the model said "zavolá vám kolega" without calling `request_callback` (R3).
- Measured, Sonnet 5.5: the same prompt passed all dates and the hard dialogues — a stronger model
  narrows the gap but does not make arithmetic or promises guaranteed.
- Overselling the last pieces under concurrency cannot be prevented by any prompt.

## Considered Options

- A — the model decides everything; the prompt holds the rules
- B — the model chooses, the code decides: the code supplies a calendar, the catalogue and prices,
  computes totals, enforces the cut-off and daily limits in the database, saves only on an explicit
  confirmation step, and checks promised callbacks at the end of the call
- C — no model in the order path: a fixed voice menu (IVR, "press 1 for bread")

## Decision Outcome

Chosen option: **B**.

- **Dates:** the code writes the next 14 days into the prompt (date, weekday, today/tomorrow/the day
  after, closed days); the model looks a day up and returns an ISO date; the server rejects a closed
  or past day.
- **Products and prices:** the catalogue comes from the database; `prepare_order` returns the lines
  and the total; the agent reads back only that result.
- **Saving:** `confirm_order` saves the last prepared order; the server refuses it unless a
  `prepare_order` exists in the same call.
- **Limits and cut-off:** enforced in a database transaction at `confirm_order`; the second of two
  racing orders for the last pieces is refused.
- **Callbacks:** `request_callback` creates a record; at call end the server scans the agent's own
  words for a callback promise (e.g. "zavolá", "kolega") and, if no record exists, creates one marked
  "promised, not recorded by the agent" so it still reaches the staff.

### Consequences

- Good, because the failures measured are removed by construction, not by hoping the prompt holds.
- Good, because a cheaper, faster model becomes viable for the phone (latency matters there).
- Bad, because the end-of-call promise check is a heuristic on text; it is a safety net, not the
  main path, and its misses are counted in the test suite.

### Confirmation

- The scripted utterances and dialogues (`spikes/czech-voice/`) are the regression suite; dates
  must pass 10/10.
- Server tests that must fail if the rule is removed: `confirm_order` without `prepare_order` is
  refused; a closed-day order is refused; two concurrent orders for the last piece → exactly one
  saved; a transcript with "zavolá vám kolega" and no record → a callback record exists after
  the call.

## Pros and Cons of the Options

### A — Model decides

- Good, because it is the least code.
- Bad, because measured: 4/10 wrong dates with Haiku; promises without records.

### B — Model chooses, code decides

- Good, because each measured failure has a deterministic guard.
- Bad, because more tool and server code.

### C — IVR menu

- Good, because it is fully deterministic.
- Bad, because a menu of 10+ products with quantities and days is slow and hated by callers; it
  does not save the bakery time compared with a person.

## More Information

`specs/001-voice-ordering/research.md` R1–R4; constitution principle I.

## Relations

- Amended by ADR-0010 (2026-11-24): catalogue IDs are an enum in the tool schema, and tool descriptions say when not to call.
