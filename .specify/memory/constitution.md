<!--
Sync Impact Report
- Version: 1.1.0 → 1.2.0 (2026-11-24)
- Added: Engineering standard — evaluation of the probabilistic agent (ADR-0012) and LLMOps
  (ADR-0013); Process — the eval gate in CI
- 1.1.0 (2026-11-24):
- Changed: Problem — "no customer is lost": three ways to order over one core (ADR-0009);
  Engineering standard — stack adds the Expo staff app (ADR-0009); [proposed] tags replaced by
  [owner] after the owner accepted all rules and ADRs 0001–0009 on 2026-11-24
- 1.0.0 (2026-11-24): Problem, Principles I–VII, Engineering standard, Process, Governance
- Templates: .specify/templates/* used unchanged (Spec Kit 0.16.2); plan-template's Constitution
  Check is filled from the principles below
- Follow-up: none
-->

# Bakery Voice Orders — Constitution

A solution for a small bakery whose owner says: _"People call us to reserve bread and pastry.
Managing the reservations and working out what to bake takes a lot of our time."_ Built as a
recruitment assignment for Cod8; reviewed together with the reviewers afterwards, so **every
decision must be explainable from a written source**.

Every rule carries its source:

- `[brief]` — the owner's sentence above, the only input from the client
- `[owner]` — a decision of the project owner (Tomasz), with its date
- `[measured]` — follows from a measurement; the numbers are in the cited `research.md`
- `[proposed]` — a choice made by the author without the owner's explicit approval yet; it binds,
  but the owner can change it in one sentence, which is then recorded here (none at 1.1.0)
- `[ADR-NNNN]` — a decision in `docs/adr/` with the options considered

A rule without a source is a defect of this file.

## Problem

Two jobs hide in the brief, and a solution that removes only one of them solves half the problem:

1. **Taking the call** — someone stops working, talks, writes the order down, re-types it later.
2. **Working out what to bake** — every evening someone adds up the reservations before the night
   shift.

Customers are often older and used to calling; the solution MUST NOT require them to change the
habit. `[brief]` `[ADR-0002]`

**No customer is lost.** Every way a customer reaches the bakery — the AI line, an ordinary phone,
the counter, the web — ends in an order in the same list and the same baking plan: the voice agent,
the staff app (one spoken sentence or a form) and the web form all go through one order core.
`[owner]` 2026-11-24 `[ADR-0009]`

## Principles

### I. The model chooses, the code decides

The language model understands the customer and **picks from what the code gives it**. Dates,
prices, totals, availability, daily limits, the cut-off, saving an order and recording a promised
callback are **computed or enforced by code**, never by the model's own arithmetic or memory.

Measured on 2026-11-24: with dates left to the model, 4 of 10 orders had a wrong pickup date
("v sobotu" → Sunday, "pozítří" → tomorrow); with a code-written calendar, 0 of 10. In the same
runs the model once promised a callback without recording it. `[measured]` `[ADR-0003]`
(`specs/001-voice-ordering/research.md` R1–R3)

### II. Nothing invented, nothing saved without a yes

A product, price or availability that is not in the bakery's data never reaches the customer.
An order is saved only after the agent has read it back — from the code's summary, not from its
own sum — and the customer has said yes explicitly. A dropped call before the yes saves nothing.
`[owner]` 2026-11-24 `[ADR-0003]`

### III. No silent failure, no broken promise

A failure the customer or the staff would not notice is the worst kind. When the voice provider is
down, the call screen says so and the web form and staff panel keep working. A callback the agent
promised is a record the staff see at the top of the panel; the server checks at the end of every
call that a promised callback exists. `[owner]` 2026-11-24 `[measured]` (research R3)

### IV. Measure before choosing; record what refuted a hypothesis

A provider, model, threshold or default is chosen from a measurement on our own cases, not from a
vendor's benchmark or intuition. A constant without a measurement is debt and is marked as such.
A refuted hypothesis is a result and is written down with what refuted it. `[owner]` 2026-11-24

### V. Tell people they talk to a machine; keep little, keep it briefly

The agent's first sentence says it is an automated assistant and offers a human callback (EU AI
Act, Art. 50). Only the data needed for a pickup is kept: name, phone, items, day. Call transcripts
are kept with the order for staff to check and deleted after 30 days. `[owner]` 2026-11-24 `[ADR-0008]`

### VI. No paid tokens without the owner's yes

Development and evaluation run on the owner's existing Claude subscription through the `claude`
CLI. Any call that is billed per token or per minute (voice providers, model APIs) runs only after
the owner agrees to that run. `[owner]` 2026-11-24 `[ADR-0004]`

### VII. Development only from the specs

Code is written only to carry out a task in `specs/NNN-*/tasks.md` and does what that spec's
functional requirements say — nothing more. When the spec is missing or wrong, the spec changes
first and the decision is recorded (below), then the code. `[owner]` 2026-11-24 `[ADR-0001]`

## Engineering standard

- **Standard over invention.** Framework defaults, official documentation and established libraries
  first; anything unusual needs an ADR saying why the standard is not enough. `[owner]` 2026-11-24
- **Stack:** TypeScript end to end; Next.js for the API, the core and the customer site; Expo (React
  Native, also built for the web) for the staff app; shared types; one PostgreSQL database.
  `[owner]` `[ADR-0007]` `[ADR-0009]`
- **Limits live in the database.** A daily limit or cut-off is enforced by a constraint or a
  transaction, so two concurrent orders can never oversell the last pieces — never by the prompt.
  `[owner]` 2026-11-24 `[ADR-0003]`
- **Tests check behaviour**, including the agent's: the scripted Czech utterances and dialogues
  in the spike are the regression suite for the prompt and tools. A fix's test fails when the fix
  is reverted. `[owner]` 2026-11-24
- **The agent is evaluated as a probabilistic system**: repeated runs with confidence intervals,
  deterministic graders before any model-as-judge, a judge only after calibration against the
  owner's labels, a regression gate against a stored baseline. `[owner]` 2026-11-24 `[ADR-0012]`
- **Every call is observable**: a trace with tool calls, latencies, tokens, shadow cost, prompt
  version and outcome, personal data masked; errors in Sentry; alerts on latency, failures and
  quota. `[owner]` 2026-11-24 `[ADR-0013]`
- **Secrets** never reach the repository, a log or a commit; keys are created and entered by the
  owner. `[owner]`

## Process

- **Spec Kit** (0.16.2): `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
  `/speckit-implement`; `/speckit-analyze` for consistency. `[owner]` `[ADR-0001]`
- **Where decisions live** `[ADR-0001]`:
  - a rule that holds everywhere → this constitution;
  - a choice that crosses features, or sets product, architecture or process → `docs/adr/NNNN-*.md`
    (MADR, template in `docs/adr/template.md`, index in `docs/adr/README.md`);
  - a choice inside one feature → that feature's `research.md` (Decision / Rationale / Alternatives
    rejected / Evidence).
    A decision recorded only in a commit message, a code comment or chat is a defect.
- **Every decision is written in detail**: the problem, the options actually considered, the
  chosen one and why, its consequences, how compliance is checked, and the evidence (a measurement,
  a URL with its date, or the owner's words with the date). `[owner]` 2026-11-24
- **CI** (GitHub Actions) runs types, lint, deterministic tests and the eval gate on every change and
  the full eval nightly; every change gets a preview deployment with its own database branch.
  `[owner]` `[ADR-0013]`
- **Commits** name the spec and task IDs; commit, push, repository creation and deployment happen
  only after the owner's explicit yes, each time. `[owner]`
- **Language:** English in the repository (code, specs, ADRs, commits); the product speaks Czech.
  `[owner]`

## Governance

This constitution takes precedence over other practices in this repository. Amendments are made in
this file with a Sync Impact Report and a semantic version bump: MAJOR when a principle is removed
or redefined, MINOR when one is added or a section is added, PATCH for a refinement. Every plan
fills its Constitution Check from the principles above; a violation is justified in writing in the
plan's Complexity Tracking or the design changes.

**Version**: 1.2.0 | **Ratified**: 2026-11-24 (owner accepted all rules and ADRs 0001–0013 on 2026-11-24) | **Last Amended**: 2026-11-24 (1.2.0)
