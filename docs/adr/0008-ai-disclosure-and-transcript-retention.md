---
status: accepted
date: 2026-11-24
decision-makers: owner
---

# ADR-0008: The agent says it is an automated assistant in its first sentence; only pickup data is kept; call transcripts are deleted after 30 days

## Context and Problem Statement

Callers talk to a machine and give their name and phone number; the call is transcribed so the
staff can check the order. What must the caller be told, and what is kept for how long?

## Decision Drivers

- EU AI Act, Art. 50(1): people must be informed they are interacting with an AI system, unless it
  is obvious. Applies from 2 August 2026.
- GDPR data minimisation and storage limitation (Art. 5(1)(c), (e)).
- The staff need the transcript to trust and correct phone orders (ADR-0002).

## Considered Options

- A — disclosure in the first sentence; keep name, phone, items, day; transcript 30 days
- B — no explicit disclosure; keep transcripts indefinitely
- C — disclosure; no transcripts at all

## Decision Outcome

Proposed option: **A**. Greeting (draft): "Dobrý den, Pekárna U Lípy, tady automatický asistent.
Rád vám zarezervuju pečivo, nebo vám může zavolat kolega." Transcripts are deleted 30 days after
the pickup day; orders keep name, phone, items and day. The 30-day period is a proposed value, not
a measured one: long enough to settle a dispute about a pickup, short enough to hold little.

### Consequences

- Good, because the caller knows, and can ask for a human at once.
- Good, because little personal data and a clear deletion rule.
- Bad, because some callers hang up on a machine; the callback offer in the same sentence is the
  mitigation.

### Confirmation

Test: the agent's first turn contains the disclosure (TC1 of spec 001). A scheduled job deletes
transcripts past the period; a test with a fixed clock checks it.

## Pros and Cons of the Options

### A

- Good, because lawful and honest; transcripts available when needed.
- Bad, because a deletion job to maintain.

### B

- Bad, because it breaks Art. 50 and storage limitation.

### C

- Good, because the least data.
- Bad, because staff cannot check what the agent understood; trust in phone orders drops.

## More Information

- Regulation (EU) 2024/1689 (AI Act), Art. 50 and Art. 113 (application dates).
- Regulation (EU) 2016/679 (GDPR), Art. 5.
