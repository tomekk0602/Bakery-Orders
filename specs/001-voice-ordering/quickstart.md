# Quickstart: run and verify 001

## Prerequisites

- Node.js 24, npm; Docker (PostgreSQL for tests); a phone with Expo Go (optional).
- Keys created and entered by the owner into `.env` files (never committed): `GEMINI_API_KEY`,
  `DATABASE_URL`, `BETTER_AUTH_SECRET`, `DEMO_STAFF_PASSWORD`, `LANGFUSE_PUBLIC_KEY`,
  `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL` (EU), `SENTRY_DSN`, `IP_HASH_SALT`.

## Run locally

```bash
npm ci
npm run db:up            # PostgreSQL in Docker
npm run db:migrate && npm run db:seed
npm run dev              # apps/web on :3000, apps/staff (Expo) on :8081
```

## Verify

| # | Scenario | Expected | Covers |
|---|---|---|---|
| 1 | `npm test` | core, db (real PostgreSQL), API tests green; the concurrent last-piece test saves exactly one order | FR-007, SC-003, SC-004 |
| 2 | `npm run eval -- --gate` | gate cases pass^5 = 5/5; report with Wilson intervals | SC-010 |
| 3 | Remove the calendar block from `prompt.cs.md`, run 2 | the gate fails | ADR-0012 confirmation |
| 4 | Open `/`, enter a phone, "Zavolat do pekárny", say "dva kmínové chleby a šest rohlíků na sobotu, Nováková", answer "ano" | the agent reads back 162 Kč, gives an order number; the order appears in the staff app with the transcript | US1, FR-040 |
| 5 | In the staff app "Nová objednávka" → voice: "Nováková, chléb razowy na zítra" | the card marks "razowy" unmatched with candidates; nothing saved until confirm | US6, FR-020 |
| 6 | Staff app "Plán" for that day | reserved + buffer = to bake, including the new orders | US2, SC-008 |
| 7 | Call and say "chci mluvit s člověkem", give a name | a callback request with the caller's phone shows as a badge | US3, FR-041 |
| 8 | Langfuse (EU) | the call's trace has tool calls, first-audio latency, tokens, shadow cost, prompt version, no unmasked phone | FR-032, SC-011 |
| 9 | Exceed the per-IP limit on `/api/call/start` | the page says so and offers the form | FR-036 |
| 10 | "Reset demo" | the seed is back | FR-042 |
| 11 | `npm run e2e` | Playwright: web form order and staff login | smoke |
