---
status: accepted
date: 2026-11-24
decision-makers: owner
---

# ADR-0009: Three ways to order over one order core; a staff app in Expo (phone and web) takes orders by voice or by form and is also the panel

## Context and Problem Statement

ADR-0002 chose a voice agent for calls, a staff panel and a web form. The owner added a case it did
not cover (2026-11-24): a customer calls a phone that is **not** connected to the AI, or orders in
person — then the staff must be able to take the order in seconds, on a phone, "because they have
no time", by saying one sentence ("Paní Nováková, chléb razowy na zítra") or by filling a form.
The owner's goal: "so that the customer does not run away" — no situation in which a customer
cannot order.

## Decision Drivers

- No lost customer: every way a customer reaches the bakery ends in an order (owner, 2026-11-24).
- Staff have no time: one sentence or a few taps, one confirmation.
- One set of rules: catalogue, calendar, prices, cut-off, limits (ADR-0003) must hold the same in
  every channel, with one documented difference — staff may order after the cut-off.
- A few evenings of work: as few separate surfaces as possible.
- The reviewers need a link; an app-store release is not possible in days.

## Considered Options

- A — one order core (API + rules + database) and three inputs: the voice agent, a staff app in
  Expo (React Native, also built for the web) that holds voice/form ordering **and** the panel,
  and a customer web form
- B — the same three inputs, but the panel as a separate web app next to the staff mobile app
- C — keep ADR-0002 as it is: no staff ordering on the phone; staff use the web panel

## Decision Outcome

Chosen option: **A** (owner, 2026-11-24, all recommendations accepted).

**The order core** — one place for the rules (ADR-0003): catalogue, calendar, `prepare_order`
(lines and total from the database), confirmation, cut-off and limits in a transaction, the baking
plan, callbacks. Every channel calls the same core; none has its own copy of a rule.

**The three ways to order**

| | 1. Voice agent | 2. Staff app | 3. Web form |
|---|---|---|---|
| Who speaks / types | the customer | staff, after the call or at the counter | the customer |
| Who confirms | the customer, by an explicit "ano" | staff, one tap on the order card | the customer, a button |
| Cut-off | enforced | **staff may override** | enforced |
| Customer's phone | required | **optional** | required |
| AI | the conversation | only turning one sentence into an order | none |

**The staff app (Expo, React Native)** — one app for staff and owner, on the phone (Expo Go by QR
code for the reviewers) and as a web build (a link). It holds:

1. **New order** — two equal ways, the staff choose each time:
   - **by voice**: tap, say one sentence, the on-device speech recogniser (iOS/Android, the browser
     on the web build) turns it into text, the core prepares the order and the app shows a card to
     confirm with one tap; the recognised text stays editable;
   - **by form**: customer name, phone (optional), products with quantity steppers, pickup day from
     the open days, confirm.
   A word that matches no product is never guessed: the card says "nemáme »razowy«" and offers the
   closest catalogue products to pick from.
2. **Today's pick-ups** — one tap "picked up".
3. **Baking plan** — per day: reserved + buffer = to bake.
4. **Callbacks** — requests from the agent, on top until done.

One demo account for staff and owner; no roles (they add work without touching the brief).

Dictation during a mobile call on the same phone is not assumed: the call holds the microphone, so
the flow is "finish the call, say the sentence" — or type it.

**Surfaces and code layout**

1. Customer site (Next.js): "Zavolat do pekárny" button and the order form.
2. Staff app (Expo, native + web).
3. API and core (Next.js server routes, PostgreSQL); shared TypeScript types for both apps.

**Build order by risk**: core and baking plan → staff app (channel 2) → voice agent (channel 1) →
web form (channel 3). After step 2 there is a working product to show even if time runs out.

### Consequences

- Good, because no customer is lost: AI line, ordinary phone, counter and web all end in the same
  order list and the same baking plan.
- Good, because channel 2 is the fallback when the voice part fails (constitution III).
- Good, because the AI parsing used by channel 2 is the path already measured as text (research R1–R4).
- Bad, because a second app (Expo) and a monorepo with shared types; amends ADR-0007's single
  Next.js project.
- Bad, because the cut-off override must be guarded on the server by the staff login, not by the
  client.

### Confirmation

- Server tests that must fail if the rule is removed: an order after the cut-off is refused without
  a staff login and accepted with one; a sentence with an unknown product returns a "no match" with
  candidates, never a guessed line.
- The text suite gains staff-sentence cases (third person, no greeting, e.g. "Nováková, dva kmínové
  na zítra").
- The demo shows one order from each channel in the same baking plan.

## Pros and Cons of the Options

### A — One core, three inputs, staff app = panel

- Good, because three surfaces instead of four; one place for the rules.
- Bad, because Expo web is less polished for dense tables than a web-only panel.

### B — Separate web panel

- Good, because a desktop panel can be denser.
- Bad, because a fourth surface to build and keep in sync.

### C — ADR-0002 unchanged

- Good, because less work.
- Bad, because a call to a non-AI phone or an order at the counter has no fast path; the owner's
  goal is not met.

## More Information

- Amends ADR-0002 (adds channel 2 and merges the panel into the staff app) and ADR-0007 (adds Expo
  for the staff app next to Next.js).
- Expo web: https://docs.expo.dev/workflow/web/ ; Expo Go: https://docs.expo.dev/get-started/expo-go/

## Relations
- Amended by ADR-0015 (2026-11-24): roles owner and employee with server-checked permissions; two demo logins.
