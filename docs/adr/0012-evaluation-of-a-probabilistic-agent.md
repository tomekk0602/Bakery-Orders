---
status: accepted
date: 2026-11-24
decision-makers: owner
---

# ADR-0012: The agent is evaluated as a probabilistic system — three test levels, repeated runs with confidence intervals, deterministic graders first, a regression gate against a stored baseline, versioned prompts, and corrected calls turned into test cases; Evalite runs the evals

## Context and Problem Statement

The voice agent and the staff dictation are built on models whose output varies from run to run.
So far every case was run once (research R1–R12): a pass was evidence, not a rate, and a prompt or
model change could silently make things worse. How is the quality of model answers checked, kept
from regressing, and reported honestly?

## Decision Drivers

- The constitution: measure before choosing (IV); the model chooses, the code decides (I).
- Orders must be right **every** time a customer calls, not on average.
- The checks must run on every change, at no cost (ADR-0004, ADR-0011 free tier).
- A judgement made by a model must itself be checked before it is trusted.
- TypeScript stack (ADR-0007); data stays on our machines where possible.

## Considered Options

Approach:

- A — three levels (deterministic unit tests · a fixed eval set · simulated customers), each case run
  N times, deterministic graders first, LLM-as-judge only for soft qualities and calibrated, a
  regression gate against a stored baseline
- B — a fixed eval set run once per change, pass/fail
- C — manual testing before the demo

Tool for the eval levels:

- T1 — Evalite (TypeScript, on Vitest, open source, local-first)
- T2 — promptfoo (CLI and library, YAML configs, GitHub Action; acquired by OpenAI in March 2026, the
  open-source project to be continued)
- T3 — a hosted eval platform (LangSmith, Braintrust)
- T4 — our own scripts (the spike harness)

## Decision Outcome

Chosen: **A with T1 (Evalite)** (owner, 2026-11-24).

**Three levels**

1. **Deterministic tests (Vitest)** for everything the code decides: catalogue, calendar and closed
   days, totals, cut-off and staff override, daily limits under concurrent orders (on a real
   PostgreSQL), the baking plan. The baking-plan arithmetic is also tested with generated inputs
   (fast-check): for any set of orders and buffers, to-bake = reserved + buffer per product.
2. **Fixed eval set (Evalite)** — the Czech single utterances and dialogues, both for the customer
   agent and for staff sentences ("Nováková, dva kmínové na zítra"). Graded in code: the prepared and
   the saved order equal the expected order; nothing saved without a confirmation; no product outside
   the catalogue; dates from the calendar.
3. **Simulated customers (Evalite)** — a model plays a Czech customer from a goal (ADR-0010); at the
   end the saved order is compared in code with the expected order. Scenarios include an unavailable
   product, a failing tool, a silent customer, a correction, a request for a human.

**Testing a probabilistic system**

- Every eval case runs **N = 5** times (proposed value; raised for the gate cases if the intervals are
  too wide).
- Results are reported as a **pass rate with a 95% Wilson interval**, never as a single pass.
- Two rates per case: **pass@k** (right at least once — "can it do it") and **pass^k** (right in all k
  runs — "does it do it every time"). The gate uses pass^k for anything that saves an order.
- Temperature, model id and prompt version are recorded with every result.

**Graders**

- **Deterministic first**: order equality, tool-call presence and order, no save without
  confirmation, enum membership, dates.
- **LLM-as-judge only for soft qualities** — politeness, natural Czech, that a refusal names an
  alternative. The judge is **calibrated**: the owner labels about 20 transcripts, the judge's
  agreement with those labels is reported, and a judge below the agreed threshold is not used in the
  gate. The judge runs on a different model from the agent (Sonnet 5.5 through the CLI, ADR-0004, or a
  free-tier Gemini model in CI).

**Regression gate**

- A **baseline** (pass rates per case and their intervals) is stored in the repository
  (`evals/baseline.json`) with the prompt version and model that produced it.
- Every change to the prompt, tools, vocabulary or model runs the evals and compares with the
  baseline. The change is **blocked** when any order-saving case drops below its threshold (proposed:
  pass^5 = 5/5 for the scripted gate cases), or when a rate falls below the lower bound of the
  baseline's interval.
- Updating the baseline is an explicit commit that says why.

**Versioned prompts**

- The agent's instructions, tool descriptions and vocabulary live in versioned files; the version is
  stored on every order and every trace (ADR-0013), so a wrong order can be traced to the prompt that
  took it.

**From production to tests**

- A phone order that staff corrected in the app, or a call that ended in a callback, can be turned
  into an eval case with one action; the transcript is anonymised (name and phone replaced) before it
  enters the repository.

### Consequences

- Good, because quality is a number with an interval, compared on every change; a regression is
  caught before it reaches a caller.
- Good, because a model judging a model is checked against a human before it counts.
- Bad, because N runs multiply the calls: the full suite runs nightly, a small gate set on every change
  (ADR-0013), both within the free tier.
- Bad, because simulated customers are themselves models; their scenarios fail when the customer
  model misbehaves. Such runs are flagged by checking the simulated customer's own transcript against
  its goal.

### Confirmation

- `npm run test` (deterministic) and `npm run eval` (Evalite) exist and run in CI (ADR-0013).
- A deliberate regression — e.g. removing the calendar from the prompt (research R1) — makes the
  gate fail; this is kept as a test of the gate itself.
- The judge's agreement with the owner's labels is recorded in `research.md`.

## Pros and Cons of the Options

### A — Three levels, repeated runs, gate

- Good, because it treats the agent as what it is: probabilistic.
- Bad, because more runs and more code than a single pass.

### B — One run per change

- Bad, because measured: the same case passed in one run and failed in another (R7 vs R12); one run
  cannot tell a regression from noise.

### C — Manual testing

- Bad, because nothing stops a regression between demos; nothing to show.

### T1 — Evalite

- Good, because TypeScript on Vitest, like the rest; local-first, so transcripts stay on our machines;
  custom scorers and traces.
- Bad, because younger than promptfoo; fewer ready-made assertions.

### T2 — promptfoo

- Good, because mature, many assertion types, a GitHub Action.
- Bad, because YAML configs beside TypeScript code; its future after the acquisition is still being
  shaped.

### T3 — Hosted platform

- Bad, because paid tiers and conversation data leaving our machines.

### T4 — Own scripts

- Good, because they already exist (the spike).
- Bad, because standard over invention: a runner, reporting and history exist ready-made. The spike's
  cases and graders move into Evalite.

## More Information

- Evalite: https://github.com/mattpocock/evalite (read 2026-11-24)
- promptfoo acquisition: https://openai.com/index/openai-to-acquire-promptfoo/ (2026-03-09)
- Wilson score interval: E. B. Wilson (1927), "Probable inference, the law of succession, and
  statistical inference", JASA 22(158).
- fast-check: https://github.com/dubzzz/fast-check
- Related: ADR-0004, ADR-0010, ADR-0011, ADR-0013; `specs/001-voice-ordering/research.md`.
