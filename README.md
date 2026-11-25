# Pekárna U Lípy — bread reservations without the phone ringing all day

> _"People call us to reserve bread and pastries. Managing the reservations and working out what to
> bake takes us a lot of time."_ — the bakery owner

## Part 1 — How it solves the problem

**Customers order the way they like.**

- **They call the bakery, as they always have.** An assistant picks up straight away, in Czech, and
  says it is an automated assistant. It takes what they want, for which day and their name, reads the
  order back with the price and saves it only when the customer says yes. The customer hears an order
  number. If they would rather speak to a person, the assistant records the request and someone from
  the bakery calls back.
- **Or they fill in a short form on the bakery's website** — the same offer, the same rules, an order
  number at the end.

**Staff stop writing on paper.**

- **When a customer is at the counter or on the shop phone**, staff take the order in the bakery's
  app on their phone or tablet — tap it in, or **just say one sentence**: _"Nováková, two caraway
  loaves for tomorrow"_. The app fills in the order and asks only about what it did not understand.
- **Every order lands in one list**, whichever way it came: phone, web or counter. For phone orders,
  staff can read exactly what the customer said.
- **The baking plan works itself out.** For each day the app shows how many of each product to bake:
  what is reserved plus what the shop usually sells over the counter (the owner sets that estimate).
- **Nothing slips through.** Requests for a callback, a change or a cancellation wait in their own tab
  with a badge until someone handles them. Closed days, the order deadline and daily limits are
  respected automatically, so the bakery never promises bread it will not bake. When a customer calls
  off an order, staff cancel it in two taps and the bread goes back into the plan.
- **Staff hear about new orders and requests at once.** While the app is open, every new order,
  callback request or the next day's baking summary slides in from the top of the screen with a
  short sound — who ordered, for when, what and for how much — and a tap opens it. The same
  notifications wait under the bell 🔔, and on a computer or phone where staff allow it they arrive
  as device notifications too (without the customer's name on the lock screen). Each person chooses
  what reaches them and sets quiet hours.
- **The owner sees how it is going**: how many calls ended in an order, how fast the assistant
  answers, and what it would cost.

**Demo vs. real use.** In this demo you "call" by pressing a button on the website, so it can be tried
from any computer. In real use the bakery keeps its own phone number: calls are forwarded to the same
assistant, and customers just dial the number they already know.

**Not in this version yet:** changing an order's items or day in the app (such requests are recorded
for a person, who can cancel and take it again), payments, recipes and ingredient planning.

## Part 2 — Try it in three minutes

|                 | Link                                       | Access                                  |
| --------------- | ------------------------------------------ | --------------------------------------- |
| Customer site   | https://web-delta-sand-34.vercel.app       | public                                  |
| Staff app (web) | https://web-delta-sand-34.vercel.app/staff | two accounts, credentials sent by email |

The two staff accounts show the two roles: **Majitel** (owner — everything, including settings and
operations) and **Prodavač** (shop assistant — orders, plan, requests).

1. **Call the bakery.** Open the customer site in Chrome, Edge or Safari, enter any phone number,
   press **Zavolat do pekárny** and allow the microphone. Headphones help. Say for example _"Dobrý
   den, dva kmínové chleby a šest rohlíků na sobotu, Nováková"_, then _"ano"_ when it reads the order
   back. You get an order number.
2. **See it as the bakery does.** Sign in to the staff app. **Plán** shows Saturday's baking plan with
   your order in it. The order and the call transcript are in **Dnes** on the pickup day.
3. **Take an order as staff.** **Nová objednávka** → say or type one sentence, e.g. _"Novák, pět
   kaiserek na zítra"_. An unknown word (try _"razowy"_) is never guessed: you pick from suggestions.
4. **Ask for a person.** Call again and say you want to speak to someone. The request appears in
   **Požadavky** with a badge.
5. **See the notifications.** Keep the staff app open (both accounts in two browser windows, if you
   like) and place an order on the customer site: within about 10 seconds a banner with the order
   slides in from the top, with a sound after the first click in the app. Tap it to open the order.
   Under 🔔 → **Zapnout upozornění v tomto zařízení** the browser also gets device notifications.
6. **Owner only — Provoz.** Calls by outcome, the assistant's response time, orders per channel and
   the cost on a paid tier.

The web form is under the call button. **Nastavení → Reset demo** restores the demo data.

## Part 3 — How it is built

**Main technologies**

| Area            | Choice                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Phone assistant | Google **Gemini Live** (speech to speech, Czech), the browser connects with a one-use token; every tool call runs on our server |
| Staff dictation | **Gemini Flash-Lite** with a structured answer (products and days as fixed lists)                                               |
| Web app and API | **Next.js** + **TypeScript** on **Vercel** (EU, Frankfurt)                                                                      |
| Staff app       | **Expo / React Native** — the same app on a phone and in the browser                                                            |
| Data            | **PostgreSQL** on **Neon** (Frankfurt), **Drizzle** ORM; sign-in with **Better Auth** and two roles                             |
| Quality         | **Vitest** with real PostgreSQL in containers; **Evalite** for repeated agent evals; **GitHub Actions** CI with an eval gate    |
| Operations      | **Langfuse** traces (EU) with masked personal data; cost and latency per call                                                   |

### Key decisions

Each is one line here and a full record with the rejected options in [`docs/adr/`](docs/adr/README.md);
"R" numbers are measurements in [`research.md`](specs/001-voice-ordering/research.md).

| Decision                                                                                      | Why                                                                                                  | Rejected                                                                                    | ADR                                                                                    |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| A voice agent answers the calls; a staff panel plans the baking                               | The time goes into the phone; the plan is arithmetic                                                 | Only a web form — assumed many callers would not switch (to check with the owner)           | [0002](docs/adr/0002-voice-agent-answers-calls-staff-panel-plans-baking.md)            |
| **The model chooses, the code decides**                                                       | Dates, prices and limits must be right every time; the model only picks from lists the code gives it | Letting the model compute dates and totals — measured wrong (R1)                            | [0003](docs/adr/0003-model-chooses-code-decides.md)                                    |
| Products and pickup days are enumerations in the tool schema                                  | A product or a day outside the offer cannot even be expressed                                        | Free text checked afterwards                                                                | [0010](docs/adr/0010-voice-agent-patterns-from-reference-implementations.md)           |
| Gemini Live speech-to-speech for the call; Flash-Lite for staff dictation                     | Measured on Czech: first audio ~2 s; free tiers                                                      | A transcription → LLM → speech cascade — slower (R11, R12)                                  | [0011](docs/adr/0011-demo-voice-gemini-live-with-fallbacks.md)                         |
| Three ways to order over one core                                                             | Phone, web and staff share every rule; one implementation                                            | Separate logic per channel                                                                  | [0009](docs/adr/0009-three-order-channels-one-core-staff-app.md)                       |
| The agent is evaluated as a probabilistic system                                              | One passing run proves little; quality is a rate with an interval                                    | Manual testing; single runs                                                                 | [0012](docs/adr/0012-evaluation-of-a-probabilistic-agent.md)                           |
| Traces, cost and latency from the first call                                                  | Wrong orders and slow answers must be traceable to a prompt version                                  | Logs only                                                                                   | [0013](docs/adr/0013-llmops-ci-cd-observability-cost.md)                               |
| Disclosure in the first sentence; transcripts deleted after 30 days; names masked in traces   | GDPR and honesty towards the caller                                                                  | Keeping transcripts                                                                         | [0008](docs/adr/0008-ai-disclosure-and-transcript-retention.md)                        |
| Notifications are records saved with the event; the app polls every 10 s, Web Push on devices | Nothing is lost if delivery fails; works on serverless hosting with no extra service                 | A realtime channel now — needs a long-running server or a hosted service (see Known limits) | [0016](docs/adr/0016-staff-notifications-record-with-the-event-in-app-and-web-push.md) |

### How I know it works

- **Deterministic rules are tested** (Vitest, real PostgreSQL in containers): calendar, cut-off,
  totals, the baking plan, daily limits under concurrent orders (no overselling), roles.
- **The agent's decisions are measured, not demoed.** 16 Czech customer conversations and 8 staff
  sentences, each run **5 times** against the real tools and a real database, graded in code (right
  products, day, name; saved only after a yes; nothing outside the catalogue), reported as pass rates
  with **95% Wilson intervals**, pass@k and pass^k ([`packages/evals`](packages/evals)). **These runs
  are text, on Gemini Flash-Lite standing in for the Live model**: the same instructions, tools and
  server, but no voice. They show whether the agent decides right, not how well it hears.
- **The voice itself has been checked only on a handful of real Gemini Live calls** (research R21, R28):
  orders saved correctly, the first reply audio about 2 seconds after the caller stops. There is no
  repeated voice eval yet.
- **The evals found real defects, which were then fixed and re-measured** (research R25): the model
  wrote the year 2025 into a pickup date (2/5 → 5/5 after making the day an enumeration), and after a
  manipulation attempt it forgot the name already given (1/5 → 4/5). Baseline today: **115/120 text
  trials (96%, 95% CI 91–98%)**.
- **A regression gate in CI** blocks a change to the agent when an order-saving case drops below 5/5;
  removing the calendar from the prompt makes it fail, which is how the gate itself was tested. It is
  **red today on purpose**: one case (d05, 4/5) is an open defect, not hidden.
- **Every call is a trace** in Langfuse with each tool call, tokens, cost and the prompt version;
  measured on the first calls: about **0.04 USD per minute** of call on a paid tier.

### What the code guarantees, and what the model does

| Guaranteed by the server, whatever the model says                                                       | Behaviour of the model — instructed, and measured by the evals                                    |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Only products from the offer and open days within 14 days can be ordered; the price is the price list's | Understanding what the customer wants and asking when unsure                                      |
| The order deadline and closed days are checked when the order is read back **and again at the yes**     | Reading the order back from the system's summary                                                  |
| Daily limits hold under simultaneous orders                                                             | Calling `confirm_order` **only after** the customer agrees (a grader in every eval run checks it) |
| A call can confirm only its own draft; staff only their own                                             | Offering a person when it does not understand (weak: 2/5)                                         |

The server cannot hear the customer say _"ano"_: saving after agreement is the model's behaviour,
tested, not a guarantee. Everything that would make an order wrong if the model erred is in the left
column.

### Known limits

- **Browser call instead of a phone number.** For the bakery's own number, calls are forwarded to a
  telephony provider that streams the audio to the same assistant; that step is not built or measured
  yet.
- **Free tiers.** The demo runs on free model quotas; if they run out, the call says so and offers the
  form. Calls are capped at 3 minutes and limited per IP.
- **Measured on a small sample.** Latency and cost come from a handful of calls; the voice itself
  (recognition of Czech over a phone-quality line) has no repeated eval yet.
- **Shared demo data.** Reviewers see each other's test orders; **Reset demo** restores the seed.
- **Notifications arrive by polling.** The open staff app asks the server every 10 seconds, so a banner
  appears up to 10 s after the order. That is deliberate for the demo: the app runs as serverless
  functions on Vercel, which cannot keep a WebSocket open (the Node counterparts of SignalR —
  Socket.IO, `ws` — need a long-running server), and polling needs no extra service. Where device
  notifications are switched on, the push reaches the open app at once. **In production** the
  better design is a hosted realtime channel (Pusher, Ably or Supabase Realtime) or a small
  Socket.IO service: after an order is saved the server publishes a signal without personal data and
  every open app refreshes immediately, with polling kept only as a slow fallback. Details in
  [research N16](specs/002-staff-notifications/research.md).

### Run it locally

```bash
npm ci
npm run db:up                         # PostgreSQL in Docker
npm run db:migrate && npm run db:seed
npm run seed:staff -w @bakery/web     # demo accounts, passwords written to a git-ignored file
npm run dev                           # customer site and API on :3000
npm run web -w @bakery/staff          # staff app on :8081
npx web-push generate-vapid-keys      # optional: device notifications (VAPID_* in apps/web/.env.local)
npm test                              # all workspaces
npm run eval -w @bakery/evals         # agent evals (needs GEMINI_API_KEY, ~20 min)
```

Keys go into git-ignored `.env` files; the full list is in
[`specs/001-voice-ordering/quickstart.md`](specs/001-voice-ordering/quickstart.md).

### Repository map

| Where                           | What                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `apps/web`                      | Next.js: customer site, call client, API, server side of the agent                         |
| `apps/staff`                    | Expo (React Native) staff app; its web build is served under `/staff`                      |
| `packages/core`                 | The bakery's rules and the agent definition — no I/O                                       |
| `packages/db`                   | Schema, migrations, repositories, the agent's tool runner                                  |
| `packages/evals`                | Eval cases, graders, statistics, the regression gate, baseline                             |
| `specs/001-voice-ordering`      | Spec, plan, tasks, and **research.md — every measurement and decision inside the feature** |
| `specs/002-staff-notifications` | Notifications for staff: bell, banner with sound, device notifications, daily summary      |
| `docs/adr`                      | Cross-cutting decisions with the options rejected                                          |

Built spec-first: requirements, tasks and decisions are written before the code, and a decision or a
measurement that changes the plan is recorded with what changed it.
