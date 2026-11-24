# Bakery Voice Orders — start here

A solution for a small bakery: an AI voice agent takes reservation calls in Czech, a staff panel
turns reservations into a baking plan, and a web form is a second channel. Recruitment assignment
for Cod8 (2026-11-24). This file is the entry point for every AI coding tool and every contributor.

## Development only from the specs

Nothing is built that is not written in a spec. Every code change carries out a task from
`specs/NNN-*/tasks.md` and does exactly what that spec's requirements say. A missing, wrong or
incomplete spec is fixed first — with the decision recorded — and only then the code.

## Read before you change anything

1. **The constitution** — `.specify/memory/constitution.md`. Rules, each with its source.
2. **The decisions** — `docs/adr/` ([index](docs/adr/README.md)).
3. **The spec of the feature you touch** — `specs/NNN-*/spec.md`, with `research.md`, `plan.md`,
   `tasks.md` when present.

## Where things live

| What | Where |
|---|---|
| Rules that hold everywhere | `.specify/memory/constitution.md` |
| Cross-cutting decisions (MADR) | `docs/adr/NNNN-*.md` |
| Decisions and measurements inside one feature | `specs/NNN-*/research.md` |
| Czech understanding and voice test harness | `spikes/czech-voice/` |

A decision recorded anywhere else — a commit message, a code comment, chat — is a defect
(ADR-0001).

## How work is done

- Spec Kit 0.16.2: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`;
  `/speckit-analyze` for consistency.
- Commits: Conventional Commits naming the spec and task IDs. Commit, push, repository creation and
  deployment only after the owner's explicit yes, every time.
- No paid API runs without the owner's yes (constitution VI). Keys are entered by the owner only.
- English in the repository; the product speaks Czech.
