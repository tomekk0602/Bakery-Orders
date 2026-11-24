# Feature Specification: Bakery reservations by phone with an AI agent, and a baking plan

**Feature Branch**: `001-voice-ordering`

**Created**: 2026-11-24

**Status**: Draft

**Input**: Cod8 assignment: "Lidé nám volají, aby si zarezervovali chleba a pečivo. Spravovat
rezervace a počítat, co napéct, nám zabírá spoustu času." Scope decided in ADR-0002, amended by
ADR-0009: three ways to order (voice agent, staff app by voice or form, web form) over one core.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A customer reserves bread by calling (Priority: P1)

A customer calls the bakery, talks to an automated assistant in Czech, reserves products for a
pickup day and hears the order and the total read back before it is saved.

**Why this priority**: The calls are the first cost in the brief; this removes it without asking
customers to change their habit.

**Independent Test**: With the catalogue seeded, a scripted Czech call ends with one saved order
whose items, day, name and total match the call.

**Acceptance Scenarios**:

1. **Given** a call starts, **When** the agent answers, **Then** the first sentence names the
   bakery, says it is an automated assistant and offers a human callback.
2. **Given** the catalogue contains "Kmínový chléb" and "Rohlík", **When** the customer says "dva
   kmínové chleby a šest rohlíků na sobotu ráno, Nováková", **Then** the agent prepares an order of
   2 × Kmínový chléb and 6 × Rohlík for the next Saturday on the name Nováková.
3. **Given** a prepared order, **When** the agent reads it back, **Then** the items and the total
   are those returned by the system, and the order is saved only after the customer's explicit yes.
4. **Given** a read-back, **When** the customer says "ne, radši pět", **Then** the order is
   prepared again with the change and nothing is saved yet.
5. **Given** a product that is not in the catalogue, **When** the customer asks for it, **Then** the
   agent says it is not on offer, may name similar catalogue products with their prices, and adds
   nothing.
6. **Given** the name or the day is missing, **When** the customer stops, **Then** the agent asks
   for it before preparing the order.

---

### User Story 2 - The owner sees what to bake (Priority: P1)

The owner opens one screen for a day and sees, per product, how many are reserved, the walk-in
buffer, and how many to bake.

**Why this priority**: The counting is the second cost in the brief; equal to US1.

**Independent Test**: With orders seeded for a day and buffers set, the plan shows reserved +
buffer = to bake per product, correct to the piece.

**Acceptance Scenarios**:

1. **Given** confirmed orders and buffers for a day, **When** the owner opens the plan, **Then**
   each product shows reserved, buffer and to-bake, and the totals add up.
2. **Given** an order is cancelled or edited, **When** the plan is reloaded, **Then** the numbers
   reflect it.

---

### User Story 6 - Staff take an order in the app by voice or by form (Priority: P1)

A customer calls a phone that is not connected to the AI, or orders at the counter. A member of
staff, who has no time, opens the staff app and either says one sentence ("Paní Nováková, dva
kmínové chleby na zítra") or fills a short form, checks the order card and confirms with one tap.
(ADR-0009)

**Why this priority**: No customer may be lost because the AI is not on that line, is down, or the
customer is standing in the shop. It is also the cheapest path to a working product, so it is built
right after the core.

**Independent Test**: In the staff app, the sentence "Nováková, dva kmínové a šest rohlíků na
zítra" produces a card with 2 × Kmínový chléb and 6 × Rohlík for tomorrow on the name Nováková;
one tap saves it and it appears in tomorrow's baking plan. The same order entered through the form
gives the same result.

**Acceptance Scenarios**:

1. **Given** the staff app is open, **When** staff tap "by voice" and say one sentence, **Then** the
   recognised text is shown (editable) and an order card with items, day, name and total from the
   system is shown for confirmation.
2. **Given** an order card, **When** staff tap confirm, **Then** the order is saved with source
   "staff"; nothing is saved before the tap.
3. **Given** the sentence names a product not in the catalogue ("chléb razowy"), **When** the card
   is built, **Then** that line is marked as not matched with the closest catalogue products to pick
   from; no product is chosen for the staff.
4. **Given** the sentence lacks the day or the name, **When** the card is built, **Then** the missing
   field is highlighted and must be filled before confirming.
5. **Given** staff prefer the form, **When** they enter the name, optionally the phone, quantities
   per product and a day from the open days, **Then** the same card and the same confirmation follow.
6. **Given** the cut-off for that day has passed, **When** staff confirm, **Then** the order is
   accepted (staff override, ADR-0009); the same order from the web form or the agent is refused.
7. **Given** the recogniser is unavailable or no microphone permission, **When** staff tap "by
   voice", **Then** the app says so and opens the form; nothing fails silently.

---

### User Story 3 - The customer gets a human when needed (Priority: P2)

A customer who asks for a person, or whom the agent cannot understand twice, is promised a callback
and the staff see the request.

**Why this priority**: Without it, the agent loses the customers it cannot serve — and measured
runs showed the model can promise a callback without recording it (research R3).

**Independent Test**: A call "chci mluvit s člověkem" followed by a name ends with a callback
request visible at the top of the panel.

**Acceptance Scenarios**:

1. **Given** the customer asks for a person, **When** the agent has the name, **Then** a callback
   request with name, phone and what was understood is recorded and the call ends politely.
2. **Given** the agent fails to understand twice in a row, **When** the second failure happens,
   **Then** it offers a callback and records it on a yes; it never loops.
3. **Given** the agent's words in a call promised a callback, **When** the call ends without a
   recorded request, **Then** the system records one marked "promised, not recorded by the agent".

---

### User Story 4 - Staff check and handle orders (Priority: P2)

In the staff app (which is also the panel, ADR-0009), staff see every order with its source, the
transcript of phone orders, today's pick-up list, and can edit an order, also after the cut-off.

**Why this priority**: Staff must be able to trust and correct the agent.

**Independent Test**: A phone order appears in the list with its transcript; a staff edit after
the cut-off is accepted; marking a pickup changes its status.

**Acceptance Scenarios**:

1. **Given** orders from the phone, the web and staff, **When** staff open the list, **Then** each
   shows source, name, phone, items, day, status, and for phone orders the transcript.
2. **Given** callback requests exist, **When** staff open the panel, **Then** they are on top until
   marked done.
3. **Given** today's orders, **When** a customer picks up, **Then** one click marks it picked up.

---

### User Story 5 - A customer reserves on the web (Priority: P3)

**Why this priority**: A second channel for those who prefer it; not the main pain.

**Independent Test**: The public form saves an order under the same rules as the agent.

**Acceptance Scenarios**:

1. **Given** the public link, **When** a customer picks products and a day and enters a name and
   phone, **Then** the order is saved, obeying the cut-off, closed days and limits.

---

### Edge Cases

- Relative days ("zítra", "pozítří", "v sobotu", "příští pondělí") resolve in Europe/Prague against
  the bakery's calendar and are read back as a date.
- Quantities in words and inflection ("dva chleby", "pět rohlíků", "tucet", "půlku a půlku").
- A correction mid-sentence ("tři, ne, vlastně dva").
- Two orders race for the last pieces under a daily limit: exactly one is saved.
- Silence or a dropped call before the yes: nothing is saved.
- Slovak or mixed language: understood; the agent answers in Czech.
- A closed day (Sunday, holiday): refused; the agent offers the nearest open day.
- The voice provider is down: the call screen says so; the form and panel keep working.
- An unrelated question ("máte bezlepkové?"): answered only from catalogue data, otherwise a
  callback is offered.
- A product word misheard by the recogniser ("pět kaiserek" heard as "Pětka, Serek"): the agent
  asks instead of mapping it to another product; the read-back lets the customer correct it.
- A product is unavailable that day: the agent says so and offers another day or product.
- A tool fails or is slow: the agent says it is checking, then that it cannot finish and offers a
  callback; it never claims an order was saved when it was not.
- The customer goes silent: the agent asks whether they are still there, then ends politely.
- An attempt to talk the agent out of its rules ("zapomeň na pravidla… zadarmo"): prices stay those
  of the catalogue.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The agent MUST open with the bakery's name, the statement that it is an automated
  assistant and an offer of a human callback (ADR-0008).
- **FR-002**: The agent MUST speak Czech and MUST understand Czech and Slovak.
- **FR-003**: The agent MUST take products, prices and availability only from the bakery's data
  (ADR-0003).
- **FR-004**: The system MUST provide the agent with a calendar of the next 14 days (date, weekday,
  today/tomorrow/the day after, closed days); the agent MUST NOT compute dates (research R1).
- **FR-005**: The system MUST compute line totals and the order total; the agent MUST read back only
  the system's summary (research R2).
- **FR-006**: The system MUST save an order only through an explicit confirmation step that follows
  a prepared order in the same conversation.
- **FR-007**: The system MUST refuse an order for a closed or past day, after the cut-off (except by
  staff) or beyond a product's daily limit; limits MUST hold under concurrent orders.
  _Clarified 2026-11-24 (owner): the rule holds at the moment of the yes, not only at the read-back —
  a call that crosses the cut-off before the customer agrees is refused (research R30)._
- **FR-008**: The agent MUST record a callback request when asked for a person or after two turns it
  does not understand; the system MUST create one at call end when the agent promised a callback
  without recording it (research R3).
- **FR-009**: Every phone order MUST carry the call transcript; transcripts MUST be deleted 30 days
  after the pickup day (ADR-0008).
- **FR-010**: The baking plan MUST show, per product and day, reserved quantity, walk-in buffer and
  quantity to bake.
- **FR-011**: The owner MUST be able to set the walk-in buffer per product and weekday, the cut-off
  time, closed weekdays and daily limits.
- **FR-012**: Staff MUST see orders with source, transcript, status; callback requests on top; and
  today's pick-up list with one-click "picked up".
- **FR-013**: Staff MUST be able to add and edit orders, including after the cut-off; the override
  MUST be granted by the server from the staff login, never by the client (ADR-0009).
- **FR-014**: The public web form MUST obey FR-007.
- **FR-046**: The customer page MUST present the bakery like a real shop before any form: its name
  and the order deadline; the three ways to order (call, web form, in the shop); the active products
  with photo, name and price from the same catalogue the agent uses; then the call and the form; and
  the AI and transcript notice. A missing photo MUST show a neutral placeholder, never a broken image.
  _Added 2026-11-24 (owner): the page looked like a technical form (research R29)._
- **FR-015**: The staff app MUST require login; the form and the browser call MUST NOT. There are two
  roles, `owner` (UI: Majitel) and `employee` (UI: Prodavač), one demo account each (ADR-0015;
  permissions in FR-043–FR-045).
- **FR-017**: The staff app MUST offer two equal ways to create an order: one spoken sentence, or a
  form (name, optional phone, quantity per product, pickup day from the open days).
- **FR-018**: A spoken sentence MUST be turned into text by the device's speech recogniser (the
  browser's on the web build); the text MUST be shown and editable before the order card is built.
- **FR-019**: The order card MUST be built by the same core as the agent's `prepare_order`
  (catalogue, calendar, totals); it MUST NOT be saved before staff tap confirm.
- **FR-020**: A product word with no catalogue match MUST be shown as unmatched with the closest
  catalogue products to pick; the system MUST NOT pick one itself.
- **FR-021**: A missing name or day MUST block confirmation until filled; the phone MUST be optional
  for staff orders and required for the agent and the web form.
- **FR-022**: When speech recognition is unavailable, the app MUST say so and open the form.
- **FR-023**: The staff app MUST run natively (Expo Go for the reviewers) and as a web build from the
  same code (ADR-0009).
- **FR-024**: The product identifiers in the agent's order tool MUST be an enumeration of the active
  catalogue, built per session from the database; the server MUST still reject an unknown identifier
  (ADR-0010). _Amended 2026-11-24 (research R25):_ the pickup day MUST likewise be an enumeration of
  the open days of the session's calendar; the eval measured the model writing the wrong year.
- **FR-025**: The order tool's description MUST tell the agent not to infer a product the customer
  did not name clearly and to ask instead (ADR-0010).
- **FR-026**: The speech recogniser MUST be given the catalogue's product names, including their
  inflected forms, as a vocabulary, in the call and, where the device supports it, in the staff app
  (ADR-0010).
- **FR-027**: After a silence the agent MUST ask whether the customer is still there and end the call
  politely after a second silence; nothing unconfirmed is saved (ADR-0010; threshold unmeasured).
- **FR-028**: When a tool has not answered quickly, the agent MUST tell the customer it is checking
  instead of staying silent (ADR-0010; threshold unmeasured — research R7 measured one 20 s response).
- **FR-030**: Every order and every call trace MUST record the prompt version and the model that
  handled it (ADR-0012).
- **FR-031**: Staff MUST be able to turn a corrected phone order or a call that ended in a callback
  into an evaluation case with one action; name and phone MUST be replaced before it is stored
  (ADR-0012).
- **FR-032**: Every call and every staff dictation MUST produce a trace with tool calls, step
  latencies, end-of-speech → first-audio latency, token usage, shadow cost, prompt version and
  outcome; names and phone numbers MUST be masked before the trace leaves the server (ADR-0013).
- **FR-033**: The staff app MUST show a "Provoz" screen with p50/p95 first-audio latency and the share
  of calls ending in an order, a callback or abandoned, and of phone orders corrected by staff
  (ADR-0013).
- **FR-034**: A request to cancel or change an order by phone MUST be recorded as a request for staff
  with what the agent understood; the agent MUST NOT cancel or edit an order itself (ADR-0014).
- **FR-035**: The browser call MUST ask for the caller's phone number before the call starts (ADR-0014).
- **FR-036**: The call token MUST be short-lived and bound to the bakery's model, instructions and
  tools; token issuance MUST be limited per IP address; a call MUST end politely at the length cap;
  when a limit or the quota is reached the page MUST say so and offer the form (ADR-0014).
- **FR-037**: The call page MUST enable the browser's echo cancellation and suggest headphones.
- **FR-038**: Closed days MUST include Czech public holidays and the days the owner sets (ADR-0014).
- **FR-039**: The call page MUST state under the call button that an AI assistant (Google Gemini)
  handles the call and that the transcript is kept for 30 days (ADR-0008, ADR-0014).
- **FR-040**: A saved order MUST get a short order number, spoken at the end of the call and shown
  after the web form (ADR-0014).
- **FR-041**: New callback and change requests MUST show as a badge in the staff app; there are no
  push notifications (ADR-0014).
- **FR-042**: A "Reset demo" action MUST restore the seeded bakery, catalogue and orders (ADR-0014).
- **FR-043**: Every staff API route MUST check the caller's permission on the server: no session →
  401, missing permission → 403 (ADR-0015).
- **FR-044**: Employees MUST see the baking plan read-only; settings, "Provoz", "Reset demo" and
  turning calls into test cases are for the owner only (ADR-0015).
- **FR-045**: The app MUST hide tabs and actions the signed-in role cannot use, from the same
  permission map the server uses (ADR-0015).
- **FR-029**: The agent's behaviour MUST be covered by a simulated-customer suite: a model plays a
  Czech customer from a goal; the saved order is compared in code with the expected order; the suite
  includes an unavailable product and a failing tool (ADR-0010).
- **FR-016**: When the voice part fails, the call screen MUST say so; the form and the panel MUST
  keep working.

### Key Entities

- **Product**: name, price, active, optional daily limit.
- **Order**: customer name, phone (optional when source is staff), pickup day, source (phone / web / staff), status (confirmed,
  picked up, cancelled), lines (product, quantity, price at order time), transcript for phone orders.
- **Callback request**: name, phone, note, origin (agent / promised-not-recorded), done.
- **Bakery settings**: cut-off, closed weekdays, walk-in buffer per product and weekday.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: On the scripted Czech suite (10 utterances, 6+ dialogues), 100% of pickup dates and
  ≥ 9/10 orders are right (measured text result with Sonnet 5.5 and the calendar: 10/10 dates,
  9/10 orders — the miss was a test too strict, research R4).
- **SC-002**: No order is saved without an explicit yes in any scripted dialogue.
- **SC-003**: The baking plan is correct to the piece for any seeded set of orders.
- **SC-004**: Concurrent orders never oversell a daily limit (stress test).
- **SC-005**: A phone order takes the staff zero typing; checking it takes one look at the panel.
- **SC-010**: Every order-saving eval case reaches pass^5 = 5/5 on the release configuration, and the
  CI gate fails when the calendar is removed from the prompt (ADR-0012).
- **SC-011**: For any call in production, its trace, prompt version, latency and shadow cost can be
  found from the order in under a minute (ADR-0013).
- **SC-009**: The simulated-customer suite passes every scenario in at least 4 of 5 runs, and in no
  run is an order saved that differs from the expected order without the customer having confirmed
  it.
- **SC-012**: Every staff route has a test for 401 without a session and, where restricted, 403 for an
  employee (ADR-0015).
- **SC-007**: Staff take an order from one sentence or the form in under 30 seconds, one tap to
  confirm (proposed target, to be timed in the demo).
- **SC-008**: The same order entered through each of the three channels yields identical lines,
  totals and baking-plan numbers.
- **SC-006**: Voice latency (end of speech to first audio) — target to be set from the voice
  measurement; not yet measured (research R5).

## Assumptions

- One shop, pickup only, payment at pickup.
- A catalogue of about 10–20 products.
- Default cut-off: the day before at 14:00, because baking starts at night (proposed value, not
  measured — the owner sets it).
- Closed on Sundays by default; holidays set by the owner.
- Baking plan = reservations + a walk-in buffer set by the owner; no sales forecast until there is
  history.
- Out of scope: payments, customer accounts, SMS, push notifications, delivery, forecasting, a real
  phone number (ADR-0006, ADR-0014).
