---
status: accepted
date: 2026-11-24
decision-makers: owner
---

# ADR-0006: Reviewers try the agent through a "call the bakery" button in the browser; a real phone number is optional

## Context and Problem Statement

The assignment asks for a link to a running solution and login details. A real bakery would have
the agent on its phone number. How do the reviewers reach the agent?

## Decision Drivers

- The reviewers must be able to try it within minutes, from anywhere.
- No spend without the owner's yes; no paperwork that delays the delivery.
- The agent logic must be the same whichever way the call arrives.

## Considered Options

- A — a button "Zavolat do pekárny" in the browser (microphone), no phone number
- B — a real Czech phone number through a telephony provider
- C — a non-Czech number (cheaper, faster to get)

## Decision Outcome

Proposed option: **A**. B is added only if it can be connected quickly and cheaply, and only with
the owner's yes; the agent sits behind one interface, so a phone line is another input, not a
rewrite.

### Consequences

- Good, because it works immediately for anyone with Chrome and a microphone.
- Good, because no telephony cost or number registration.
- Bad, because it is not the bakery's real experience (no caller ID, no phone audio quality); the
  README says so, and the phone-band variant of the voice test covers the audio side.

### Confirmation

The demo page has the button; the README states how a phone line would attach.

## Pros and Cons of the Options

### A — Browser call

- Good, because instant and free.
- Bad, because the phone path is shown only on paper.

### B — Czech number

- Good, because it is the real thing.
- Bad, because Czech numbers from telephony providers usually need address and identity
  verification, which takes time; monthly and per-minute cost.

### C — Foreign number

- Good, because faster to get.
- Bad, because the reviewers would make an international call to a "Czech bakery"; poor fit.

## More Information

Telephony verification requirements vary by provider; to be checked when B is considered.
