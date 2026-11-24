---
status: accepted
date: 2026-11-24
decision-makers: owner
---

# ADR-0014: The demo is two links, an Expo Go code and one demo login, on seeded data with a reset; the public call is protected by a session-bound token, per-IP limits and a call length cap; the remaining call details are settled

## Context and Problem Statement

The brief asks for "a link to a running solution and your login details". The reviewers must be
able to try every way of ordering within minutes, without breaking anything for each other, and the
public call button must not be able to exhaust the free model quota or be used for anything but the
bakery. Several details of the call were still open: cancellations, the caller's phone number, echo,
holidays, the AI notice, an order number, staff notifications.

## Decision Drivers

- It must work for people who did not build it, on their own devices.
- No silent failure (constitution III); no customer lost (ADR-0009).
- Free tiers (constitution VI, ADR-0011); personal data minimised (ADR-0008).
- Standard over invention.

## Considered Options

Demo access: two links + Expo Go + one demo login (A) · a single combined web app (B) · a recorded
video only (C).

For each open detail, the options are listed in the outcome with the one rejected.

## Decision Outcome

Chosen (owner, 2026-11-24): **A**, and the details below.

**Demo access**

1. **Customer site** (public): "Zavolat do pekárny" and the order form.
2. **Staff app**, web build (login) and an **Expo Go code** published through EAS Update, so it runs on
   a phone without the developer's machine.
3. **One demo login** for staff and owner. The credentials are sent to the reviewers in the reply,
   never stored in the repository.
4. **Seed data**: an invented bakery "Pekárna U Lípy", about 12 products, walk-in buffers, orders for
   the coming week so the baking plan is not empty. A **"Reset demo"** action restores the seed.
5. **Czech user interface**; English in the repository.
6. **README for reviewers**: a three-minute walkthrough (call and order → see the order with its
   transcript → order as staff by voice → tomorrow's baking plan changed) and a summary of the
   decisions with links to the ADRs.
7. **A two-minute backup video** of the same walkthrough, in case a live part is down or the quota is
   exhausted.

**Call details**

| # | Question | Decision | Rejected |
|---|---|---|---|
| 1 | Cancelling or changing by phone | the agent records a **request for staff** with what it understood; it never cancels or edits itself | the agent cancels by name and phone — a browser call cannot verify who is calling |
| 2 | The caller's phone in a browser call | a **phone field before "Zavolat"**, standing in for caller ID | dictating digits — measured risk of misheard numbers ("päť" → "50", research R12) |
| 3 | Protecting the free quota | the Live token is issued **bound to our model, prompt and tools** and short-lived; **per-IP limits** on token issuance (counters in PostgreSQL); a **call length cap of 3 minutes**; when the quota or a limit is reached, the screen says so and offers the form | an open token or the API key in the browser |
| 4 | Echo | browser **echo cancellation** on, and a hint "nejlépe se sluchátky" | no handling — the agent would hear itself |
| 5 | Holidays | Czech public holidays from **`date-holidays`**, plus closed days the owner sets | a hand-written list |
| 6 | AI notice on the call page | one sentence under the button: an AI assistant (Google Gemini) handles the call; the transcript is kept for 30 days (ADR-0008) | notice only in the spoken greeting |
| 7 | Order number | the agent ends with the **order number**; the form shows it too | no confirmation — without SMS the customer would have nothing to refer to |
| 8 | Staff notifications | a **badge in the staff app** for new callback and change requests; no push notifications | push — extra setup and permissions, not needed for the brief |

The 3-minute cap and the per-IP limits are **proposed values without a measurement**; they are
replaced by values from the traces of the first week (ADR-0013, constitution IV).

### Consequences

- Good, because reviewers can try all three channels without setup and without stepping on each
  other's data (reset), and a failure shows a way forward instead of an error.
- Good, because the public call cannot be turned into a free general-purpose voice model.
- Bad, because a shared demo login means reviewers see each other's test orders; the reset makes that
  harmless.
- Bad, because the phone field is typed, not real caller ID; the README says how a phone line would
  supply it (ADR-0006).

### Confirmation

- A test issues a Live token and asserts its configuration is locked to our model, instructions and
  tools; a second asserts token issuance is refused above the per-IP limit.
- A call longer than the cap ends politely with nothing unconfirmed saved.
- "Reset demo" returns the database to the seed (tested on a database branch).
- The README walkthrough is followed once by someone other than the author before sending.

## Pros and Cons of the Options

### A — Two links + Expo Go + one login

- Good, because every channel is tried the way it would be used.
- Bad, because three entry points to explain; the README walkthrough does that.

### B — One combined web app

- Good, because one link.
- Bad, because it hides that the staff app is a phone app (ADR-0009).

### C — Video only

- Bad, because the brief asks for a running solution.

## More Information

- `date-holidays`: https://github.com/commenthol/date-holidays
- Gemini ephemeral tokens: https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
- Related: ADR-0006, ADR-0008, ADR-0009, ADR-0011, ADR-0013.
