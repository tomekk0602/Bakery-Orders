---
status: accepted
date: 2026-11-24
decision-makers: owner
---

# ADR-0013: LLMOps — GitHub Actions with an eval gate on every change and a full eval nightly, a preview deployment with its own database branch per change, Langfuse (EU) traces for every call, cost and latency metrics, Sentry for errors, and alerts

## Context and Problem Statement

A deployed AI feature needs more than working code: changes must reach production through checks
that include the model's quality (ADR-0012), and once running, every call must be traceable — what
the model heard, which tools it called, how long each step took, how many tokens it used, what it
would cost and whether it ended in an order. How is the solution deployed, observed and kept within
cost and latency?

## Decision Drivers

- Quality gates on every change, including the probabilistic part (ADR-0012).
- No migration or experiment touches the main database.
- Every call traceable to its prompt version and outcome; cost and latency known per call.
- Personal data minimised in anything that leaves our systems (ADR-0008).
- Free tiers only (constitution VI); EU data location where there is a choice.

## Considered Options

CI/CD: GitHub Actions · another CI · manual deploys.
Environments: preview per change with a database branch (Vercel + Neon) · one shared staging ·
production only.
LLM observability: Langfuse Cloud (EU) · Arize Phoenix (self-hosted) · LangSmith · Helicone · only
our own logs.
Errors: Sentry · only logs.

## Decision Outcome

Chosen (owner, 2026-11-24):

**CI/CD — GitHub Actions**

- On every push and pull request: typecheck, lint, format check, the deterministic tests (ADR-0012
  level 1, PostgreSQL in a service container) and a **small eval gate** — about 10 order-saving cases,
  N = 5, on the free Gemini tier, with the API key in GitHub secrets. The gate fails the build as
  defined in ADR-0012.
- **Nightly**: the full eval suite (all cases and simulated customers); the report is kept as a build
  artifact and its summary posted to the run.
- The free-tier budget is planned: the gate uses about 100 requests per run of the 500 a day of
  Flash-Lite (research R10); the nightly run is sized to fit the rest. If the limit is reached the job
  says so and fails loudly, never passes silently.
- Deploys happen only from a green `main`, and only with the owner's yes (constitution, Process).

**Environments — Vercel + Neon**

- Every change gets a **preview deployment** with **its own Neon database branch**, created from
  production's schema and seed; migrations run there first. Production is touched only after the
  preview is green.
- The staff app's web build deploys the same way; native builds go out through EAS Update (ADR-0009).
- Production region: EU (Vercel functions and Neon in Frankfurt), next to the Gemini API's EU data
  terms (ADR-0005/0011 references).

**Observability — Langfuse Cloud, EU region**

- Every customer call and every staff dictation is a **trace**: session start and end, each tool call
  with arguments and result, each model step, the end-of-speech → first-audio latency measured in the
  browser, token usage from the provider's usage metadata, the **prompt version**, the model id, and
  the outcome (order saved / callback / abandoned / error).
- Names and phone numbers are **masked** before a trace leaves our server; transcripts in traces are
  kept no longer than the 30 days of ADR-0008 (the Hobby plan's data access is 30 days).
- Langfuse is used through its OpenTelemetry-based TypeScript SDK; the code depends on OpenTelemetry
  concepts, so another backend can replace it.

**Cost**

- Each trace carries the **cost the call would have on the paid tier**, computed from token usage
  and the provider's published prices (stored in one versioned price table with its source and date).
  On the free tier the cost is zero; the shadow cost shows what production would pay per call and per
  order.

**Performance and business metrics**

- p50 / p95 of end-of-speech → first audio, tool latency, call length; share of calls that end in an
  order, in a callback, abandoned; share of phone orders corrected by staff. Shown on a "Provoz" screen
  in the staff app and in Langfuse dashboards.

**Errors — Sentry** (free Developer plan) for the Next.js server and client and the Expo app, with
the same masking.

**Alerts** (to e-mail in the demo): p95 first-audio latency above the target, a rise in failed or
abandoned calls, the free-tier quota near its limit, any Sentry error in the order path. Thresholds
start as proposals and are set from the first week of measurements (constitution IV).

### Consequences

- Good, because the model's quality is part of CI, not a manual step; a regression blocks the merge.
- Good, because any wrong order can be followed from the call trace to the prompt version that took
  it, with its latency and cost.
- Good, because migrations and experiments never touch the main database.
- Bad, because three more services (GitHub Actions, Langfuse, Sentry) with their own accounts and
  keys; the owner creates them and enters the keys.
- Bad, because free tiers cap volume (Langfuse 50k units a month, Sentry's developer quota, Gemini's
  daily limits); enough for a demo, named as limits in the README.

### Confirmation

- The CI workflow file exists; a pull request that removes the calendar from the prompt fails the
  eval gate (ADR-0012 confirmation).
- A test call in a preview deployment produces a Langfuse trace with tool calls, latency, tokens,
  shadow cost, prompt version and outcome, and no unmasked phone number.
- A deliberately thrown error in the order path appears in Sentry and triggers the alert.

## Pros and Cons of the Options

### GitHub Actions

- Good, because next to the code, free for this volume, secrets built in.
- Bad, because eval runs on the free model tier compete with the demo for the daily quota.

### Preview per change with a Neon branch

- Good, because every change is tested on real infrastructure with an isolated database.
- Bad, because more moving parts than a single staging.

### Langfuse Cloud EU

- Good, because open source (MIT), an EU region, traces, prompt versions, cost and dashboards; free
  Hobby plan.
- Bad, because the Hobby plan keeps 30 days and 50k units a month.

### Arize Phoenix (self-hosted)

- Good, because open source, all data with us.
- Bad, because a server to run — we have none (ADR-0007).

### LangSmith / Helicone

- Bad, because LangSmith's useful tiers are paid and centred on LangChain; Helicone is a proxy in the
  request path, which does not fit a browser-to-Live connection.

### Only our own logs

- Bad, because no trace view, no cost or latency dashboards; invention over standard.

### Sentry

- Good, because the standard for error tracking in Next.js and Expo; free tier.
- Bad, because one more processor of data; masking required.

## More Information

- Langfuse pricing and regions: https://langfuse.com/pricing , https://langfuse.com/security/data-regions
  (read 2026-11-24)
- Neon branching: https://neon.com/docs/introduction/branching
- Vercel preview deployments: https://vercel.com/docs/deployments/preview-deployments
- Sentry for Next.js: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- Related: ADR-0007, ADR-0008, ADR-0011, ADR-0012.
