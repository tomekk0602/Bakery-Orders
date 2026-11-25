# Tasks: Bakery reservations by phone with an AI agent, and a baking plan

**Input**: `specs/001-voice-ordering/` — plan.md, spec.md, research.md, data-model.md, contracts/,
quickstart.md; ADR-0001–ADR-0014.

**Tests**: required (constitution "Tests check behaviour"; ADR-0012). Test tasks come before the code
they cover and must fail first.

**Order**: by risk, as ADR-0009 sets it — core and baking plan → staff app (channel 2) → voice agent
(channel 1) → web form (channel 3) → operations and demo. After Phase 4 there is a working product.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US6 from spec.md; setup, foundational and polish tasks have none
- Every task names its files and the FRs / ADRs it carries out

---

## Phase 1: Setup

- [x] T001 Create the npm-workspaces monorepo: root `package.json` (workspaces `apps/*`, `packages/*`), `tsconfig.base.json` (strict), `.nvmrc` (24), `.editorconfig` (R13)
- [x] T002 [P] Configure ESLint (typescript-eslint) and Prettier at the root; scripts `lint`, `format`, `typecheck`
- [x] T003 [P] Create `packages/core` (TypeScript, Vitest, zod 4, date-fns 4, `@date-fns/tz`, date-holidays) with an empty public index
- [x] T004 [P] Create `packages/db` (drizzle-orm 0.45, drizzle-kit, `pg`, `@neondatabase/serverless`) and `docker-compose.yml` with PostgreSQL for local runs and tests (R14)
- [x] T005 [P] Create `apps/web` with Next.js 16 (App Router, Tailwind 4), Czech `lang="cs"`, depending on `@bakery/core` and `@bakery/db`
- [ ] T006 [P] Create `apps/staff` with Expo SDK 58 + Expo Router (iOS, Android, web), depending on `@bakery/core`; verify it starts in Expo Go and as a web build (FR-023, ADR-0009)
- [ ] T007 [P] Create `packages/evals` with Evalite 0.19 and Vitest (ADR-0012, R18)
- [ ] T008 Add root scripts `dev`, `test`, `eval`, `e2e`, `db:up`, `db:migrate`, `db:seed`; extend `.gitignore` (`.env*`, build output, Expo caches)

---

## Phase 2: Foundational (blocks every story)

### Core rules — tests first

- [x] T009 [P] Calendar tests in `packages/core/src/calendar.test.ts`: 14 days from a fixed Prague clock, today/tomorrow/the day after, closed weekdays, Czech holidays, owner's closed days, DST boundaries (FR-004, FR-038, R1, R20)
- [x] T010 [P] Pricing tests in `packages/core/src/pricing.test.ts`: line and order totals; fast-check property — total = Σ quantity × unit price (FR-005)
- [x] T011 [P] Order-rule tests in `packages/core/src/orders.test.ts`: unknown or inactive product, past or closed day, outside the window, cut-off for customer vs staff, missing name/day, phone required for phone/web but optional for staff (FR-003, FR-007, FR-013, FR-021)
- [x] T012 [P] Baking-plan tests in `packages/core/src/baking-plan.test.ts`: reserved + buffer = to bake; cancelled orders excluded; fast-check property over random orders and buffers (FR-010, SC-003)

### Core rules — implementation

- [x] T013 [P] `packages/core/src/catalogue.ts`: product type, active filter, spoken forms (data-model `product`)
- [x] T014 [P] `packages/core/src/calendar.ts`: open-day calendar in Europe/Prague with date-holidays (CZ) (makes T009 pass)
- [x] T015 [P] `packages/core/src/pricing.ts` (makes T010 pass)
- [x] T016 `packages/core/src/orders.ts`: `prepareOrder(input, context)` → draft with summary or a closed-set refusal (makes T011 pass)
- [x] T017 [P] `packages/core/src/baking-plan.ts` (makes T012 pass)

### Agent definitions

- [x] T018 [P] `packages/core/src/agent/tools.ts`: zod schemas of `prepare_order`, `confirm_order`, `request_staff`; product enum built from the active catalogue; JSON Schema export with `z.toJSONSchema`; Czech descriptions including "do not infer, ask" (contracts/agent-tools.md, FR-024, FR-025, ADR-0010)
- [x] T019 [P] `packages/core/src/agent/prompt.cs.md` + `prompt.ts`: instructions with the greeting and AI notice, the calendar block, the catalogue with prices, read-back from the tool result only, callback after two misunderstandings, customer and staff modes; `VERSION` file (FR-001, FR-002, FR-005, FR-008, FR-030, R5)
- [x] T020 [P] `packages/core/src/agent/vocabulary.ts`: vocabulary from product spoken forms, capped in size (FR-026, research R12 over-correction note)
- [x] T021 [P] Tests for T018–T020 in `packages/core/src/agent/agent.test.ts`: the enum equals the active catalogue; the prompt contains the 14-day calendar and no inactive product; changing any agent file without bumping `VERSION` fails a test
- [ ] T022 [P] `packages/core/src/contracts/`: zod request/response schemas of every route in contracts/http-api.md and the closed error codes

### Database

- [x] T023 Drizzle schema in `packages/db/src/schema.ts` for every table in data-model.md, plus the Better Auth tables; first migration
- [x] T024 Integration tests in `packages/db/src/orders.repo.test.ts` on PostgreSQL via `@testcontainers/postgresql`: confirm saves lines and capacity in one transaction; **two concurrent confirms for the last piece → exactly one saved** (SC-004, R14); staff edit adjusts capacity by the difference; cancel releases capacity
- [x] T025 `packages/db/src/orders.repo.ts`: drafts, confirm with the conditional capacity update, edit, cancel, pick-up, order numbers from a sequence (makes T024 pass; FR-006, FR-007, FR-040)
- [ ] T026 [P] `packages/db/src/requests.repo.ts`, `calls.repo.ts`, `settings.repo.ts`, `rate-limit.repo.ts` (upsert counter per window), each with an integration test
- [x] T027 [P] `packages/db/src/seed.ts`: "Pekárna U Lípy", ~12 products with spoken forms and limits, buffers per weekday, orders for the coming week, the demo staff user with the password from `DEMO_STAFF_PASSWORD` (ADR-0014)
- [ ] T028 `packages/db/src/reset.ts` + test: truncates bakery data and re-runs the seed (FR-042)

### Web app foundation

- [x] T029 Better Auth in `apps/web/lib/auth.ts` and `app/api/auth/[...all]/route.ts` with the drizzle adapter and the Expo plugin; a `requireStaff()` helper for staff routes (FR-015, R15)
- [ ] T030 [P] Route-handler helpers in `apps/web/lib/http.ts`: zod parsing of bodies with the shared contracts, the error envelope, IP hashing with `IP_HASH_SALT`
- [x] T031 [P] Observability in `apps/web/instrumentation.ts`: OpenTelemetry with the Langfuse span processor (EU), a masking processor for names and phones, Sentry for Next.js (FR-032, ADR-0013, R19) — _Langfuse done (R27); Sentry moved to T076_
- [ ] T032 [P] Test of the masking processor in `apps/web/lib/telemetry.test.ts`: no phone number or customer name survives export

**Checkpoint**: core, database and web foundation pass their tests.

---

## Phase 3: User Story 6 — Staff take an order by voice or form (P1)

**Goal**: a sentence or a form becomes an order card; one tap saves it (ADR-0009).
**Independent test**: "Nováková, dva kmínové a šest rohlíků na zítra" → correct card → confirm → in tomorrow's plan.

- [x] T033 [P] [US6] API tests in `apps/web/app/api/staff/staff.test.ts`: dictation returns a card with unmatched words and candidates and missing fields; form order returns the same card shape; confirm after the cut-off works with a staff session and is refused without one (FR-013, FR-017–FR-021)
- [x] T034 [US6] `POST /api/staff/dictation` in `apps/web/app/api/staff/dictation/route.ts`: Gemini 3.5 Flash-Lite with the tool definitions in staff mode; `prepare_order` runs through the core; unmatched words → candidates by spoken-form similarity; trace span `dictation` (R17, FR-019, FR-020)
- [x] T035 [P] [US6] `POST /api/staff/orders` (form → draft card) and `POST /api/staff/orders/[draftId]/confirm` (FR-017, FR-019)
- [ ] T036 [P] [US6] Staff login screen `apps/staff/app/(auth)/login.tsx` with `@better-auth/expo`
- [x] T037 [US6] "Nová objednávka" screen `apps/staff/app/(tabs)/nova.tsx`: voice button with expo-speech-recognition (cs-CZ, vocabulary as contextual strings where supported), editable text, form mode, the order card with unmatched-word pickers and missing-field highlights, one-tap confirm (FR-017, FR-018, FR-020, FR-021)
- [x] T038 [US6] No-microphone / no-recogniser path: the screen says so and opens the form (FR-022)
- [x] T039 [P] [US6] Component tests for the card states in `apps/staff/components/OrderCard.test.tsx`

**Checkpoint**: staff can take an order end to end — a working product.

---

## Phase 4: User Story 2 — The owner sees what to bake (P1)

- [x] T040 [P] [US2] `GET /api/staff/plan` + test (FR-010)
- [x] T041 [P] [US2] `GET/PUT /api/staff/settings` + test: cut-off, closed weekdays and days, buffers, limits (FR-011)
- [x] T042 [US2] "Plán" screen `apps/staff/app/(tabs)/plan.tsx`: day picker, per product reserved / buffer / to bake, totals (FR-010, SC-003)
- [x] T043 [P] [US2] Settings screen `apps/staff/app/nastaveni.tsx` (FR-011)

**Checkpoint**: channel 2 and the baking plan work — both jobs of the brief, without any voice.

---

## Phase 5: User Story 1 — A customer reserves by calling (P1)

**Goal**: a browser call to Gemini Live that ends in a confirmed order with a number.
**Independent test**: quickstart scenario 4.

- [x] T044 [US1] Spike: check `ai.authTokens.create` and `liveConnectConstraints` field names against `@google/genai` 3.6 types; record the result in research R16 (open item)
- [ ] T045 [P] [US1] Tests in `apps/web/app/api/call/call.test.ts`: `/start` issues a token bound to our model, instructions, tools and vocabulary; refuses above the per-IP limit; tool route validates arguments with the shared schemas, refuses `confirm_order` without a draft from the same call, takes the phone from the call record (FR-006, FR-035, FR-036)
- [x] T046 [US1] `POST /api/call/start`: per-IP limit, call record, ephemeral Live token locked to the bakery config, cap seconds (R16, FR-036)
- [x] T047 [US1] `POST /api/call/[id]/tools/[name]`: runs `prepare_order`, `confirm_order`, `request_staff` through the core and repositories; span `tool.<name>` (contracts/agent-tools.md)
- [x] T048 [P] [US1] ~~`POST /api/call/[id]/events`~~ — not built: first-audio samples and usage arrive with `end` (research R27). Was: `POST /api/call/[id]/events`: first-audio latency, fallback and error events into the call record and trace (FR-032)
- [x] T049 [US1] `POST /api/call/[id]/end`: stores the transcript, runs the promised-callback check, sets the outcome, closes the trace (FR-008, FR-009)
- [x] T050 [P] [US1] Test of the promised-callback check: "zavolá vám kolega" without a record → a `promised_not_recorded` request (FR-008, research R3)
- [x] T051 [US1] Call client `apps/web/components/call/live-client.ts`: Live session with the token, AudioWorklet capture at 16 kHz with echo cancellation, 24 kHz playback, tool calls forwarded to the API, first-audio timing, cap timer with a polite end (FR-027, FR-036, FR-037, R16)
- [ ] T052 [US1] Silence and slow-tool handling: the prompt's "Jste tam ještě?" after silence and "Moment, ověřuji" when a tool exceeds the threshold (thresholds proposed, unmeasured) (FR-027, FR-028, ADR-0010)
- [ ] T053 [US1] Customer page `apps/web/app/(customer)/page.tsx`: phone field, "Zavolat do pekárny", AI and retention notice under the button, live captions, headphones hint, error states for rate limit, quota and unavailable voice with a link to the form (FR-016, FR-035, FR-037, FR-039)
- [ ] T054 [US1] Fallback cascade `apps/web/components/call/cascade.ts` + `POST /api/call/[id]/turn`: Transcribe Live → Flash-Lite with the same tools → browser speech synthesis; the page says the call continues in a simpler mode (ADR-0011, FR-016)
- [ ] T055 [P] [US1] Test that a forced Live failure switches to the cascade and that a forced cascade failure offers the form (ADR-0011 confirmation)

**Checkpoint**: a call from the browser ends in an order visible to staff.

---

## Phase 6: User Story 3 — The customer gets a human when needed (P2)

- [x] T056 [P] [US3] `GET /api/staff/requests`, `POST /api/staff/requests/[id]/done` + test (FR-012, FR-034, FR-041)
- [x] T057 [US3] "Požadavky" screen `apps/staff/app/(tabs)/pozadavky.tsx` with the badge count on the tab (FR-041)

---

## Phase 7: User Story 4 — Staff check and handle orders (P2)

- [ ] T058 [P] [US4] `GET /api/staff/orders`, `PATCH /api/staff/orders/[id]` + tests (edit, pick-up, cancel with capacity) (FR-012, FR-013) — _list, pick-up and cancel with capacity done (research R31); editing lines or the day is open_
- [ ] T059 [US4] "Odběry" screen `apps/staff/app/(tabs)/odbery.tsx`: today's pick-ups, one-tap picked up; order detail with source and transcript; edit (FR-012)
- [ ] T060 [P] [US4] "Udělat z toho test" action: `POST /api/staff/eval-cases` with anonymisation + test (FR-031, ADR-0012)

---

## Phase 8: User Story 5 — A customer reserves on the web (P3)

- [x] T061 [P] [US5] `GET /api/catalogue`, `POST /api/orders/preview`, `POST /api/orders` + tests: same rules as the agent, order number, 10 orders per IP per hour (FR-014, FR-040)
- [x] T062 [US5] Form on the customer page with a review step and an inline confirmation with the order number; no public page per order number (R23) (FR-014, FR-040)
- [ ] T090 [US5] Customer page as a shop: header, "how to order", product grid with photos and prices from the catalogue, call and form, notice; generated illustrative photos in `apps/web/public/images/` (R32) (FR-046, research R29)

---

## Phase 9: Evaluation (ADR-0012)

- [x] T063 [P] Move the spike cases into `packages/evals/cases/`: customer utterances and dialogues (u08 as a dialogue, research R4), staff sentences, expected orders
- [x] T064 [P] Graders in `packages/evals/src/graders.ts`: order equality against the test database, no save without confirmation, enum membership, dates from the calendar
- [x] T065 [P] Statistics in `packages/evals/src/stats.ts` + tests: Wilson interval, pass@k, pass^k
- [x] T066 Customer and staff suites in one `agent.eval.ts` (one process, one request pacer): each case N = 5 on Flash-Lite with the real tools (`runCallTool`) against a test database; report with intervals (research R24)
- [ ] T067 `simulated.eval.ts`: a simulated Czech customer from a goal (Sonnet through the CLI locally, a free Gemini model in CI); scenarios include an unavailable product, a failing tool, silence, a correction, a request for a human (FR-029)
- [x] T068 Gate: `baseline.json`, a comparison script, `npm run eval -- --gate` exits non-zero on regression; a test that removes the calendar block and expects the gate to fail (SC-010)
- [ ] T089 Fix d05: after a refused manipulation attempt the agent asks again for what the customer already said (4/5 at `2026-11-24.4`, research R25); re-measure, then a new baseline (SC-010)
- [ ] T069 [P] Voice eval `packages/evals/voice/`: the spike's Live runner with the vocabulary, clean and phone-band clips, latency report (nightly)
- [ ] T070 [P] Judge for tone and Czech: calibration set of ~20 transcripts labelled by the owner, agreement reported in research.md; used in the gate only above the agreed threshold

---

## Phase 10: Operations (ADR-0013) and demo (ADR-0014)

- [x] T071 [P] `.github/workflows/ci.yml`: install, typecheck, lint, format check, unit and integration tests (PostgreSQL through Testcontainers); the eval gate in `eval-gate.yml` when the agent changes (research R26), `GEMINI_API_KEY` from secrets; exit 2 on quota exhaustion
- [ ] T072 [P] `.github/workflows/evals-nightly.yml`: full eval suite and the voice eval; report as an artifact and a run summary — _workflow with the text suite done; the voice eval waits for T069_
- [x] T073 [P] `GET /api/cron/retention` + Vercel Cron: delete transcripts after 30 days, expired drafts and old rate-limit rows; test with a fixed clock (FR-009, ADR-0008)
- [x] T074 [P] Shadow cost: `packages/core/src/agent/prices.ts` with source URL and date; cost per call and per dictation on the trace and the call record (ADR-0013)
- [x] T075 [US4] "Provoz" screen `apps/staff/app/(tabs)/provoz.tsx` + `GET /api/staff/provoz`: first-audio p50/p95, outcome shares, share of phone orders edited by staff (FR-033)
- [ ] T076 [P] Sentry for the Expo app with the same masking; alerts (latency p95, failed calls, quota, order-path errors) to e-mail with proposed thresholds marked as debt (ADR-0013)
- [x] T077 [P] "Reset demo" in the staff app settings calling `POST /api/staff/reset` (FR-042)
- [ ] T078 [P] Playwright smoke `apps/web/tests/e2e/`: web form order; staff login (quickstart 11)
- [ ] T079 Deployment config: Vercel project for `apps/web` and the staff web build (EU region), Neon branch per preview, EAS Update for Expo Go — **set up and deployed only with the owner's yes; accounts and keys created by the owner**
- [ ] T080 README for reviewers: links, how to log in (credentials sent separately), the three-minute walkthrough, the decisions in short with links to the ADRs, known limits (free tiers, browser call instead of a phone line)
- [ ] T081 Walk through quickstart.md on the deployed preview; record results in research.md; a person other than the author follows the README once (ADR-0014)
- [ ] T082 Record the two-minute backup video of the walkthrough (ADR-0014)

---

## Fast path — first voice order in Chrome (owner, 2026-11-24)

The owner wants to place a voice order from Chrome as early as possible. The same tasks run in this
order first; nothing outside them is built in this pass. Chrome allows the microphone on
`http://localhost`, so no deployment is needed for the first test.

1. T001, T003, T004, T005 — monorepo, core, db, web.
2. T009–T011, T013–T016 — calendar, pricing, order rules (tests first).
3. T018–T020 — tools with the enum, prompt with calendar and catalogue, vocabulary.
4. T023–T025, T027 (catalogue, settings, buffers) — schema, confirm with the conditional capacity
   update and its concurrency test, seed.
5. T044 — Live token check.
6. T045–T047, T049 (transcript only) — call API.
7. T051, T053 (phone field, call button, captions, AI notice) — call client and page.
8. **Manual test**: localhost → phone → "Zavolat do pekárny" → order → order number; the owner
   checks the order in the database.

Then: T031–T032 (traces), Phases 3–4 (staff app, plan), the rest of Phase 5, Phases 6–10.

## Staff app pass — roles and clean structure (owner, 2026-11-24; ADR-0015)

New tasks for roles and code hygiene:

- [x] T083 [P] Permission map in `packages/core/src/permissions.ts` (roles `owner`, `employee`; permissions of ADR-0015) with a `can(role, permission)` helper and tests (FR-043–FR-045)
- [x] T084 Better Auth with the `admin` plugin and access control built from T083, drizzle adapter, Expo plugin and trusted origins for the staff app; the seed creates one `owner` and one `employee` with passwords from `DEMO_OWNER_PASSWORD` and `DEMO_EMPLOYEE_PASSWORD` (replaces T029; FR-015)
- [x] T085 `requirePermission(request, permission)` in `apps/web/server/auth.ts` returning 401/403 in the error envelope; integration tests on PostgreSQL for 401 without a session and 403 for an employee on owner-only routes (FR-043, SC-012)
- [x] T086 `apps/staff` scaffold with ESLint (typescript-eslint strict, `no-explicit-any`, `no-console` as errors, `max-lines` 300), Prettier, jest-expo + React Native Testing Library + MSW (extends T002, T006)
- [x] T087 Staff app shared layer: `src/shared/api` (one HTTP client validated by the `@bakery/core` contracts), `src/shared/auth` (Better Auth Expo client, SecureStore, no stored password), `src/shared/i18n` (i18next, `cs.json`), `src/shared/ui` (tokens, Button, Card, Screen, Badge), TanStack Query provider
- [x] T088 Login screen, `Stack.Protected` for the signed-in app, tabs shown by permission with `Tabs.Protected`; component test: an employee does not see "Nastavení" and "Provoz", an owner does (FR-045, replaces T036)

Order of this pass — each step can be tried in the app:

1. T083–T088 — sign in as Majitel or Prodavač, see the tabs of the role.
2. "Dnes": T058 (list and pick-up part), T059 — today's pick-ups, order detail with the call transcript.
3. "Plán": T040, T042 — read-only baking plan (FR-044).
4. "Nová objednávka" by form: T035, the form part of T037, T039.
5. "Nová objednávka" by voice: T033, T034, the voice part of T037, T038.
6. "Požadavky": T056, T057.
7. "Nastavení" and "Reset demo" (owner only): T041, T043, T077. "Provoz" (T075) waits for traces.

## Dependencies & Execution Order

- **Phase 1** → **Phase 2** (blocks all stories).
- **US6 (Phase 3)** and **US2 (Phase 4)** depend only on Phase 2; together they are the first working
  product.
- **US1 (Phase 5)** depends on Phase 2; T044 (token spike) blocks T046 and T051.
- **US3, US4, US5** depend on Phase 2; US3 and US4 screens reuse the staff app from Phase 3.
- **Phase 9** depends on Phase 2 (core, tools, repositories) and on T034/T047 for the agent paths.
- **Phase 10**: T071 can start after Phase 2; T079–T082 come last.

### Within each phase

Tests before implementation; schemas before repositories; repositories before routes; routes before
screens.

## Parallel opportunities

- Phase 1: T002–T007.
- Phase 2: T009–T012 together, then T013–T015, T017, T018–T022; T026, T027 after T023.
- After Phase 2: Phase 3 (staff app) and Phase 5 (call) can run side by side; Phase 9 cases and
  graders (T063–T065) alongside either.

## Implementation strategy

1. Phases 1–2, then Phase 3 + Phase 4 → a working product for staff and the owner (both jobs of the
   brief).
2. Phase 5 → the voice agent; Phase 9 gate on the agent paths.
3. Phases 6–8 → callbacks, order handling, the web form.
4. Phase 10 → CI, operations, deployment (with the owner's yes), README, walkthrough, video.

No task is committed, pushed or deployed without the owner's explicit yes (constitution, Process).

## Homepage implementation (owner-approved plan, 2026-11-24)

- [ ] T091 Generate and optimize 12 consistent product photographs and one hero; save prompts and asset mapping (FR-046).
- [ ] T092 Build responsive bakery navigation, hero, ordering guidance, call section and disclosure (FR-046).
- [ ] T093 Unify product-card quantities with the existing preview/confirmation flow, accessible mobile summary and failure states (FR-046).
- [ ] T094 Verify types, lint, selection logic and browser layouts/preview flow; document verification limits (FR-046).

## Later — notifications (owner, 2026-11-24)

Specified in `specs/002-staff-notifications` (spec, plan) with ADR-0016; built from that feature's tasks.

- [ ] T095 Notifications for staff in the app: a new order, a callback / change / cancel request, an order close to the day's limit — shown in the app while it is open (spec first)
- [ ] T096 Push notifications to the staff mobile app (Expo push; device registration per signed-in staff member; personal data kept out of the notification text) — spec and ADR first

## Working a request through (owner, 2026-11-25; User Story 7, research R33)

- [x] T097 [US7] Schema: `staff_request.outcome`, `claimed_by`, `claimed_until`; table `staff_request_event`; migration (data-model)
- [x] T098 [US7] Repository + tests on PostgreSQL: actions call / unanswered / handled / unreachable (from 3 attempts) / reopen with history and notes; close reads notifications; phone match on the last nine digits; cancel-from-request in one transaction (FR-047–FR-052, SC-014)
- [x] T099 [US7] Routes: `PATCH /api/staff/requests/{id}` `{ action, note? }`, `POST …/cancel-order`; list fields; route tests incl. 403/422 (contracts)
- [x] T100 [US7] Staff app request card: "Volá …", call button records the call, "Nedovoláno", attempts line, "Uzavřít — nedovoláno" from the third, note on closing, history, the customer's orders with "Zrušit objednávku"; component tests
- [x] T101 [US7] Quickstart rows and a live run with two accounts (SC-013, SC-014) _(owner's live run 2026-11-25: call, three unanswered calls; "works")_

## Archive of closed requests (owner, 2026-11-25; User Story 8, research R34)

- [x] T102 [US8] Core: permission `request:archive` for the owner; contracts `{ open, closedToday }`, archive page and query; index migration
- [x] T103 [US8] Repository + tests: list open + closed today (Prague); archive page by keyset, outcome filter, name / phone search; retention deletes closed requests after 30 days with their steps, never open ones (FR-053–FR-057, SC-015, SC-016)
- [x] T104 [US8] Routes: list shape, `GET /api/staff/requests/archive` (403 for employees), retention count; route tests
- [x] T105 [US8] Staff app: "Dnes uzavřené (n)" folded; "Archiv" button for the owner; archive screen with filter, search, "Načíst starší", history and reopen; tests
- [x] T106 [US8] Quickstart rows and a live run (owner and employee) _(owner's live run 2026-11-25: "działa")_

## Fixes from the code review (2026-11-25; research R35)

- [x] T107 [P] Call lifecycle: end while connecting / failed start release microphone, session, speaker; unmount ends the call; tests per start stage and a refused microphone (FR-058)
- [x] T108 [P] Traces: tool span input = validated arguments, allowlisted keys only; invalid arguments not exported; tests (FR-032 clarified)
- [x] T109 [P] Staff app: query cache cleared when the signed-in user changes; test switching accounts (FR-059)
- [x] T110 Orders: `active` checked at confirmation; capacity locked and released in `productId` order; tests incl. a two-product race (FR-060, FR-061)
- [x] T111 Staff app: saving/cancelling an order and a new-order banner refresh orders and plan; tests (FR-062)
- [x] T112 Contracts: real calendar dates; phone digits 9–15; route tests for 400 (FR-063)
- [x] T113 CI: `build:deploy` in the check job; workspace dependencies declared in the manifests (R35)

## One way to confirm (owner, 2026-11-25; research R36, ADR-0017)

- [x] T114 Schema: `order_draft.web_token_hash`; migration (data-model)
- [x] T115 `confirmDraft` returns the existing order for a draft its owner already confirmed; web owner by token hash; tests incl. a retry per channel (FR-065, SC-017)
- [x] T116 Web form: preview saves a draft and returns `draftId` + token; `POST /api/orders` confirms `{ draftId, token }`; prices are the draft's; expired → "review again"; route and form tests (FR-064)
- [x] T117 Call: one end event with reason and order numbers whoever ended it; the panel shows them; tests incl. the cap (FR-066, SC-018)
- [ ] T118 Live run: web order with a double "Potvrdit", a call ended by the cap
