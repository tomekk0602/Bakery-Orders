---
status: accepted
date: 2026-11-24
decision-makers: owner
---

# ADR-0001: Work is spec-first with Spec Kit, and every decision is recorded in detail in one of three places

## Context and Problem Statement

The assignment (Cod8, 2026-11-24) is open: "what you build, in what scope and how much time you
spend is up to you", and the walkthrough afterwards is about "what your solution does, why it looks
the way it does and how you think about the problem". The reviewers will ask _why_ about every
choice. A decision that lives only in chat or in the author's head cannot be shown or checked.

## Decision Drivers

- The owner's instruction of 2026-11-24: add Spec Kit; all decisions must be described in detail,
  as in the owner's earlier projects.
- The walkthrough judges reasoning, not the amount of code.
- Code is largely written by AI agents (Claude Code); an agent needs the rules and the decisions
  in the repository, not in a conversation that ends.

## Considered Options

- A — Spec Kit (github/spec-kit) with a constitution, numbered feature specs and MADR ADRs, the
  layout the owner already uses elsewhere
- B — a single README with a "Decisions" section
- C — free-form specs and decision records (`docs/specs/*.md`, `docs/decisions/NNNN-*.md`), the
  other layout the owner has used

## Decision Outcome

Chosen option: **A**, pinned to Spec Kit **0.16.2** (the version the owner already works with), initialised with
`specify init --here --integration claude --script sh`.

Decisions are recorded in exactly one of three places:

| The statement is…                                                        | It goes to                                                                          |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| a rule that holds everywhere — how we build                              | `.specify/memory/constitution.md`                                                   |
| a choice that crosses features, or sets product, architecture or process | `docs/adr/NNNN-*.md` (MADR, `template.md`)                                          |
| a choice inside one feature                                              | `specs/NNN-*/research.md` (Decision / Rationale / Alternatives rejected / Evidence) |

Every record names the problem, the options actually considered, the choice and why, the
consequences, how compliance is checked, and the evidence: a measurement with its numbers, a URL
with the date it was read, or the owner's words with the date. A status of `proposed` means the
author chose without the owner's explicit approval; `accepted` carries the owner's date.

### Consequences

- Good, because the reviewers can read the reasoning before the walkthrough, and every answer in it
  points to a file.
- Good, because the owner already knows how to read and amend this layout.
- Bad, because writing decisions takes time inside a short assignment; mitigated by keeping each
  record to what was actually considered.

### Confirmation

Before a commit: every new behaviour traces to an FR of a spec; any choice made while implementing
is in an ADR or `research.md`. A decision found only in a commit message or comment is a defect.

## Pros and Cons of the Options

### A — Spec Kit + MADR

- Good, because it is a known, documented workflow (specify → plan → tasks → implement) with
  templates and a consistency check (`/speckit-analyze`).
- Good, because MADR forces the considered options to be written down, not only the winner.
- Bad, because it adds files a small project could live without.

### B — README section

- Good, because it is the least work.
- Bad, because options and evidence get squeezed out; decisions and rules mix.

### C — Free-form specs and decision records

- Good, because its ADRs are concrete and name the tests that must fail.
- Bad, because it has no generated plan/tasks workflow; mixing it with Spec Kit would give two
  layouts. Its good habit — naming the tests that prove a decision — is kept in "Confirmation".

## More Information

- Spec Kit: https://github.com/github/spec-kit (tag v0.16.2, read 2026-11-24)
- MADR: https://adr.github.io/madr/
