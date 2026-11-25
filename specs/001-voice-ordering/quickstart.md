# Quickstart: run and verify 001

## Prerequisites

- Node.js 24, npm; Docker (PostgreSQL for tests); a phone with Expo Go (optional).
- Keys created and entered by the owner into `.env` files (never committed): `GEMINI_API_KEY`,
  `DATABASE_URL`, `BETTER_AUTH_SECRET`, `DEMO_STAFF_PASSWORD`, `LANGFUSE_PUBLIC_KEY`,
  `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL` (EU; without the Langfuse keys tracing is off and says so in the log), `SENTRY_DSN`, `IP_HASH_SALT`, `CRON_SECRET` (the nightly retention job).

## Run locally

```bash
npm ci
npm run db:up            # PostgreSQL in Docker
npm run db:migrate && npm run db:seed
npm run dev              # apps/web on :3000, apps/staff (Expo) on :8081
```

## Verify

| #   | Scenario                                                                                                                                  | Expected                                                                                                     | Covers                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------- |
| 1   | `npm test`                                                                                                                                | core, db (real PostgreSQL), API tests green; the concurrent last-piece test saves exactly one order          | FR-007, SC-003, SC-004 |
| 2   | `npm run eval -w @bakery/evals -- --gate` (needs `GEMINI_API_KEY`; ~260 requests, ~20 min; `EVAL_TRIALS=1` or `EVAL_CASES=gate` for less) | gate cases pass^5 = 5/5; report with Wilson intervals in `packages/evals/out/report.md`                      | SC-010                 |
| 3   | `EVAL_ABLATION=no-calendar EVAL_CASES=gate npm run eval -w @bakery/evals -- --gate` (the calendar rows cut from the prompt)               | the gate fails                                                                                               | ADR-0012 confirmation  |
| 4   | Open `/`, enter a phone, "Zavolat do pekárny", say "dva kmínové chleby a šest rohlíků na sobotu, Nováková", answer "ano"                  | the agent reads back 162 Kč, gives an order number; the order appears in the staff app with the transcript   | US1, FR-040            |
| 5   | In the staff app "Nová objednávka" → voice: "Nováková, chléb razowy na zítra"                                                             | the card marks "razowy" unmatched with candidates; nothing saved until confirm                               | US6, FR-020            |
| 6   | Staff app "Plán" for that day                                                                                                             | reserved + buffer = to bake, including the new orders                                                        | US2, SC-008            |
| 7   | Call and say "chci mluvit s člověkem", give a name                                                                                        | a callback request with the caller's phone shows as a badge                                                  | US3, FR-041            |
| 8   | Langfuse (EU)                                                                                                                             | the call's trace has tool calls, first-audio latency, tokens, shadow cost, prompt version, no unmasked phone | FR-032, SC-011         |
| 9   | Exceed the per-IP limit on `/api/call/start`                                                                                              | the page says so and offers the form                                                                         | FR-036                 |
| 10  | "Reset demo"                                                                                                                              | the seed is back                                                                                             | FR-042                 |
| 11  | `npm run e2e`                                                                                                                             | Playwright: web form order and staff login                                                                   | smoke                  |

### Amendment 2026-11-25 — working a request through (User Story 7)

| Scenario                                                     | Expected                                                                           |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Two accounts; one taps the number on a callback request      | the other sees "Volá <name>" on the card                                           |
| "Nedovoláno" twice                                           | the request stays open; the card shows 2 attempts, the last time and who           |
| A third "Nedovoláno"                                         | "Uzavřít — nedovoláno" appears; closing moves it to the closed list as unreachable |
| "Vyřízeno" with a note                                       | the note, who and when show in the card's history                                  |
| A phone order, then a call asking to cancel it (same number) | the card lists the order; "Zrušit objednávku" → order cancelled, request handled   |

### Amendment 2026-11-25 — archive (User Story 8)

| Scenario                                                                         | Expected                                                                   |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Close two requests today; one closed yesterday exists                            | "Požadavky": open ones + folded "Dnes uzavřené (2)"; yesterday's not shown |
| As the employee                                                                  | no "Archiv" button                                                         |
| As the owner: Archiv → search the customer's name                                | yesterday's request is found; its history shows                            |
| Owner: "Vrátit mezi otevřené" in the archive                                     | the request is back among the open ones                                    |
| `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/retention` | `requests` counts closed requests older than 30 days                       |

### Amendment 2026-11-25 — the call window (FR-067–FR-071)

| Scenario                                  | Expected                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| "Zavolat" in the header, on a computer    | a dialog in the middle; the page stays where it was                        |
| The same on a phone (or a narrow window)  | the window fills the screen                                                |
| Type the number, press the green button   | "Volám…" with an animation, then "Hovor s pekárnou", time left, transcript |
| Esc or the close button during the call   | the call ends; the microphone indicator disappears                         |
| Finish an order and hang up               | the order number in the window                                             |
| Reload the page and open the window again | the number field is empty                                                  |

### Amendment 2026-11-25 — staff app sizing (FR-072, FR-073)

| Scenario                           | Expected                                      |
| ---------------------------------- | --------------------------------------------- |
| "Dnes" on a computer (wide window) | cards in a centred column at most 720 px wide |
| "Dnes" on a phone                  | cards fill the width as before                |
| Any button                         | 44 px tall, 16 px text                        |

### Amendment 2026-11-25 — the floating tab bar (FR-074, FR-075)

| Scenario                               | Expected                                                              |
| -------------------------------------- | --------------------------------------------------------------------- |
| Any staff page on a phone-width window | a rounded bar floating above the bottom edge; content blurs behind it |
| The same on a computer                 | the bar centred, at most 560 px wide                                  |
| Tap another tab                        | its icon turns filled, an amber pill behind it                        |
| Scroll "Dnes" to the end               | the last card stops above the bar                                     |
| Owner on a 375 px wide phone           | all six labels whole, "Nová" for the new order                        |
