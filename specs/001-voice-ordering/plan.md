# Implementation Plan: Bakery reservations by phone with an AI agent, and a baking plan

**Branch**: `001-voice-ordering` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-voice-ordering/spec.md`; decisions ADR-0001–ADR-0014.

## Summary

Three ways to order — a Czech voice agent called from the browser, a staff app taking orders by one
spoken sentence or a form, and a customer web form — over one order core that owns every rule:
catalogue, calendar with closed days and holidays, totals, cut-off, daily limits, confirmation,
callbacks and the baking plan (ADR-0003, ADR-0009). The call runs on Gemini Live with the catalogue
enum and a speech vocabulary, with a free cascade and a paid transcriber as fallbacks (ADR-0010,
ADR-0011). The agent is evaluated as a probabilistic system with a regression gate in CI, and every
call is traced with latency, tokens and shadow cost (ADR-0012, ADR-0013). The demo is two links, an
Expo Go code and one login on seeded data with a reset (ADR-0014).

## Technical Context

**Language/Version**: TypeScript 5 (strict) on Node.js 24 LTS

**Primary Dependencies** (versions read from npm on 2026-11-24; choices in research R13–R20):

| Area                          | Library                                                               | Version          |
| ----------------------------- | --------------------------------------------------------------------- | ---------------- |
| Web app, API, customer site   | Next.js (App Router, Route Handlers) + React                          | 16.4 / 19.3      |
| Staff app (iOS, Android, web) | Expo SDK + Expo Router + React Native                                 | 58 / 58 / 0.88   |
| On-device dictation           | expo-speech-recognition                                               | 58.0             |
| Schemas and validation        | zod (JSON Schema export for tool definitions)                         | 4.6              |
| Database access, migrations   | drizzle-orm + drizzle-kit, `pg` (Node) and `@neondatabase/serverless` | 0.45 / 0.31      |
| Auth                          | Better Auth + `@better-auth/expo`                                     | 1.7              |
| Models                        | `@google/genai` (Live, ephemeral tokens, Flash-Lite)                  | 3.6              |
| Time and holidays             | date-fns + `@date-fns/tz`, date-holidays                              | 4.4 / 1.5 / 3.39 |
| Styling (web)                 | Tailwind CSS                                                          | 4.3              |
| Observability                 | `@langfuse/tracing` + `@langfuse/otel` (OpenTelemetry)                | 6.1              |
| Errors                        | `@sentry/nextjs`, `@sentry/react-native`                              | 11.17 / 8.36     |

**Storage**: one PostgreSQL database — Neon (EU, Frankfurt) in production with a branch per preview;
PostgreSQL in a container for tests.

**Testing**: Vitest 5 (unit, integration on real PostgreSQL via `@testcontainers/postgresql`),
fast-check (baking plan, totals), Evalite 0.19 (agent evals, ADR-0012), Playwright 1.65 (smoke of the
customer form and staff login).

**Target Platform**: Vercel (EU) for the web app and API; modern browsers (Chrome, Edge, Safari,
Firefox for the form; the call needs microphone + WebSocket); Expo Go on iOS/Android via EAS Update;
the staff app's web build on Vercel.

**Project Type**: web application + mobile app in one npm-workspaces monorepo.

**Performance Goals**: first audio after the caller stops ≤ 3.5 s median and ≤ 6 s p95 (from research
R12: 3.3 s median, 5.2 s worst — proposed targets, re-set from the first week of traces); tool calls
answered by the server ≤ 300 ms p95 (proposed, unmeasured); staff order in under 30 s (SC-007).

**Constraints**: free tiers only (constitution VI): Gemini Live 65K tokens/min, Flash-Lite 15/min and
500/day (R10), Langfuse Hobby, Sentry Developer, Vercel Hobby, Neon Free; serverless functions — no
long-lived connections on our server (the call connects browser → Gemini, ADR-0006); personal data
masked in traces (ADR-0013); EU locations.

**Scale/Scope**: one bakery, ~12 products, a handful of simultaneous reviewers; ~12 screens across
both apps.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Principle / rule                                  | How this plan satisfies it                                                                         | Status              |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------- |
| Problem: no customer lost                         | three channels over one core; form and staff app work without voice (FR-016)                       | pass                |
| I. Model chooses, code decides                    | core computes dates, totals, limits, saving; tools take enum IDs; server validates every tool call | pass                |
| II. Nothing invented, nothing saved without a yes | `prepare` then `confirm` with a server check; enum; "do not infer" tool text                       | pass                |
| III. No silent failure, no broken promise         | fallback chain with on-screen notice; promised-callback check at call end; quota exhaustion shown  | pass                |
| IV. Measure before choosing                       | every unmeasured threshold marked as debt (call cap, IP limits, alert thresholds, latency targets) | pass (debts listed) |
| V. Disclosure and retention                       | greeting and call-page notice; 30-day transcript deletion job                                      | pass                |
| VI. No paid tokens                                | free tiers; `gpt-transcribe` backup off by default                                                 | pass                |
| VII. Only from the specs                          | tasks generated from this plan; each cites FRs                                                     | pass                |
| Standard over invention                           | libraries above; own code only for the bakery domain and the agent prompt/tools                    | pass                |
| Limits in the database                            | conditional `UPDATE … WHERE reserved + qty <= limit` in the confirm transaction                    | pass                |
| Evaluation (ADR-0012), LLMOps (ADR-0013)          | Evalite suites, CI gate, Langfuse traces, Sentry                                                   | pass                |

Re-check after Phase 1: no violations; nothing in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-voice-ordering/
├── plan.md              # this file
├── research.md          # Phase 0: measurements R1–R12 and technology decisions R13–R20
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1: how to run and verify
├── contracts/
│   ├── http-api.md      # routes of the web app used by the call page, the form and the staff app
│   └── agent-tools.md   # the tools the models may call, with their schemas and server checks
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/
├── web/                         # Next.js: customer site, API, server side of the agent
│   ├── app/
│   │   ├── (customer)/          # "/" call button + form, "/objednavka/[number]"
│   │   └── api/
│   │       ├── call/            # token, tools, events, end
│   │       ├── orders/          # web form
│   │       ├── staff/           # dictation, orders, plan, requests, provoz, reset
│   │       └── auth/[...all]/   # Better Auth
│   ├── components/call/         # Live client, mic capture, playback, fallback cascade
│   ├── instrumentation.ts       # OpenTelemetry → Langfuse, Sentry
│   └── tests/e2e/               # Playwright smoke
└── staff/                       # Expo Router app (iOS, Android, web)
    └── app/                     # (auth)/login, (tabs)/nova, odbery, plan, pozadavky, provoz

packages/
├── core/                        # the bakery domain — no I/O
│   └── src/
│       ├── catalogue.ts  calendar.ts  pricing.ts  orders.ts  baking-plan.ts
│       ├── agent/               # versioned prompt, tool definitions (zod → JSON Schema), vocabulary
│       └── contracts/           # zod schemas of the HTTP API shared by web and staff
├── db/                          # drizzle schema, migrations, seed, repositories, reset
└── evals/                       # Evalite suites, cases, graders, baseline.json

spikes/czech-voice/              # measurement harness (kept; cases move into packages/evals)
.github/workflows/               # ci.yml (every change), evals-nightly.yml
```

**Structure Decision**: npm workspaces with two apps and three packages. `packages/core` is pure and
holds every rule, so the web API, the staff app's types and the evals share one implementation
(ADR-0009 "one core"). `packages/db` is the only place that touches PostgreSQL. The staff app talks to
the web app's API over HTTP with the shared zod contracts.

## Complexity Tracking

No constitution violations to justify.
