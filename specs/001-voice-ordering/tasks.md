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
- [ ] T031 [P] Observability in `apps/web/instrumentation.ts`: OpenTelemetry with the Langfuse span processor (EU), a masking processor for names and phones, Sentry for Next.js (FR-032, ADR-0013, R19)
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
- [ ] T048 [P] [US1] `POST /api/call/[id]/events`: first-audio latency, fallback and error events into the call record and trace (FR-032)
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

- [ ] T058 [P] [US4] `GET /api/staff/orders`, `PATCH /api/staff/orders/[id]` + tests (edit, pick-up, cancel with capacity) (FR-012, FR-013)
- [ ] T059 [US4] "Odběry" screen `apps/staff/app/(tabs)/odbery.tsx`: today's pick-ups, one-tap picked up; order detail with source and transcript; edit (FR-012)
- [ ] T060 [P] [US4] "Udělat z toho test" action: `POST /api/staff/eval-cases` with anonymisation + test (FR-031, ADR-0012)

---

## Phase 8: User Story 5 — A customer reserves on the web (P3)

- [ ] T061 [P] [US5] `GET /api/catalogue`, `POST /api/orders` + tests: same rules as the agent, order number (FR-014, FR-040)
- [ ] T062 [US5] Form on the customer page and the confirmation page `apps/web/app/(customer)/objednavka/[number]/page.tsx` (FR-014, FR-040)

---

## Phase 9: Evaluation (ADR-0012)

- [ ] T063 [P] Move the spike cases into `packages/evals/cases/`: customer utterances and dialogues (u08 as a dialogue, research R4), staff sentences, expected orders
- [ ] T064 [P] Graders in `packages/evals/src/graders.ts`: order equality against the test database, no save without confirmation, enum membership, dates from the calendar
- [ ] T065 [P] Statistics in `packages/evals/src/stats.ts` + tests: Wilson interval, pass@k, pass^k
- [ ] T066 `orders.eval.ts` and `staff.eval.ts`: each case N = 5 on Flash-Lite with the real tools against a test database; report with intervals
- [ ] T067 `simulated.eval.ts`: a simulated Czech customer from a goal (Sonnet through the CLI locally, a free Gemini model in CI); scenarios include an unavailable product, a failing tool, silence, a correction, a request for a human (FR-029)
- [ ] T068 Gate: `baseline.json`, a comparison script, `npm run eval -- --gate` exits non-zero on regression; a test that removes the calendar block and expects the gate to fail (SC-010)
- [ ] T069 [P] Voice eval `packages/evals/voice/`: the spike's Live runner with the vocabulary, clean and phone-band clips, latency report (nightly)
- [ ] T070 [P] Judge for tone and Czech: calibration set of ~20 transcripts labelled by the owner, agreement reported in research.md; used in the gate only above the agreed threshold

---

## Phase 10: Operations (ADR-0013) and demo (ADR-0014)

- [ ] T071 [P] `.github/workflows/ci.yml`: install, typecheck, lint, format check, unit and integration tests with a PostgreSQL service, the eval gate on Flash-Lite with `GEMINI_API_KEY` from secrets; fails loudly on quota exhaustion
- [ ] T072 [P] `.github/workflows/evals-nightly.yml`: full eval suite and the voice eval; report as an artifact and a run summary
- [ ] T073 [P] `GET /api/cron/retention` + Vercel Cron: delete transcripts after 30 days, expired drafts and old rate-limit rows; test with a fixed clock (FR-009, ADR-0008)
- [ ] T074 [P] Shadow cost: `packages/core/src/agent/prices.ts` with source URL and date; cost per call and per dictation on the trace and the call record (ADR-0013)
- [ ] T075 [US4] "Provoz" screen `apps/staff/app/(tabs)/provoz.tsx` + `GET /api/staff/provoz`: first-audio p50/p95, outcome shares, share of phone orders edited by staff (FR-033)
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
