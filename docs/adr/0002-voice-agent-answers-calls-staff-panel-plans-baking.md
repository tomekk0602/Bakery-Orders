---
status: accepted
date: 2026-11-24
decision-makers: owner
---

# ADR-0002: An AI voice agent answers the reservation calls; a staff panel turns reservations into a baking plan; a web form is a second channel

## Context and Problem Statement

The brief: *"People call us to reserve bread and pastry. Managing the reservations and working out
what to bake takes a lot of our time."* It names two costs — the calls and the counting — and one
fact about the customers: they call. What should be built so both costs go away without asking the
customers to change?

## Decision Drivers

- Both jobs in the brief must be removed; removing one solves half the problem.
- Customers call today; many are likely older. Forcing them online loses them.
- The role is "AI Fullstack Engineer"; the solution should use AI where it removes real work, and
  keep it out where it adds risk.
- Short assignment: the scope must be finishable and demonstrable with a link and a login.

## Considered Options

- A — online shop / order form only; staff panel with a baking plan
- B — staff still answer calls, but type or dictate one sentence that an LLM turns into a
  structured order for one-click confirmation; panel with a baking plan; web form
- C — a voice agent answers the calls and takes the order; panel with a baking plan; web form
- D — a voice agent only

## Decision Outcome

Chosen option: **C**. Option B was the author's first proposal; the owner proposed answering the
calls automatically (2026-11-24),
and agreed to C with the agent as one input into the same order system rather than the whole
solution.

The pieces:

1. **Voice agent** — answers in Czech, says it is an automated assistant, takes products,
   quantities, day and name, reads the order back from the system's summary, saves it on an
   explicit yes, hands over to a human callback when asked or stuck.
2. **Staff panel** — orders with their source and, for calls, the transcript; callback requests on
   top; the baking plan for a day (reserved + walk-in buffer); today's pick-up list.
3. **Web order form** — the same rules, for customers who prefer it.

### Consequences

- Good, because the call itself disappears from the staff's day, and the counting becomes a screen.
- Good, because customers keep calling; nothing new is asked of them.
- Bad, because a voice agent is the riskiest part (Czech speech, latency, wrong orders). Mitigated
  by: measurement before choosing a provider (ADR-0004, ADR-0005), the code deciding all numbers
  (ADR-0003), every phone order carrying a transcript the staff can check, and the panel and form
  working when the voice part is down.
- Bad, because it takes longer than B (estimate 2–3 evenings instead of 1–2).

### Confirmation

The spec `specs/001-voice-ordering` has a P1 story for each of the two jobs; the walkthrough demo
shows a call ending as a line in tomorrow's baking plan.

## Pros and Cons of the Options

### A — Shop / form only

- Good, because it is simple and cheap.
- Bad, because it ignores the fact in the brief: people call. The calls continue, so the first cost
  stays.

### B — Staff dictation parsed by an LLM

- Good, because a human stays in every call; low risk; still saves the re-typing.
- Bad, because the call still costs staff time; it shortens the first job, it does not remove it.

### C — Voice agent + panel + form

- Good, because it removes both jobs and keeps the customers' habit.
- Bad, because it carries the most technical risk and needs a measurement gate.

### D — Voice agent only

- Bad, because "what to bake" is still counted by hand; half the brief.

## More Information

- Brief: Cod8 e-mail of 2026-11-24 (assignment "Řešení pro malou pekárnu").
- Measurements behind the risk: `specs/001-voice-ordering/research.md`.

## Relations

- Amended by ADR-0009 (2026-11-24): a third way to order — staff take orders in an Expo app by voice or form — and the staff panel moves into that app.
