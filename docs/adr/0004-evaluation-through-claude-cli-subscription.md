---
status: accepted
date: 2026-11-24
decision-makers: owner
---

# ADR-0004: Development and evaluation run through the `claude` CLI on the owner's subscription, with Sonnet 5.5; paid API runs only with the owner's yes

## Context and Problem Statement

The voice agent's understanding of Czech has to be measured repeatedly while the prompt and tools
change. Voice providers and model APIs bill per minute or per token. The owner decided
(2026-11-24) not to spend on paid APIs while the design is being measured.

## Decision Drivers

- No per-token spend during development (owner, 2026-11-24).
- The measurement must still be real: the same instructions, tools and scoring as the product.
- The owner already pays for a Claude subscription used through Claude Code.

## Considered Options

- A — `claude -p` (Claude Code CLI) in an isolated mode, text only, on the subscription
- B — paid APIs (OpenAI Realtime, ElevenLabs Agents) from the start
- C — a local open model (Ollama or similar)

## Decision Outcome

Chosen option: **A**, with **Sonnet 5.5** (`claude-sonnet-5-5`) as the default model (owner,
2026-11-24). Haiku 4.5 stays available as an argument for comparison.

How it runs (`spikes/czech-voice/run-claude.mjs`): `claude -p --model … --tools "" --strict-mcp-config
--disable-slash-commands --setting-sources "" --no-session-persistence --system-prompt <instructions>
--json-schema <step schema>`. No tools, no MCP, no user settings or hooks, no project files — the
model sees only the bakery's instructions. The agent's tool calls are emulated in text: each step
returns `{say, tool}`, the harness runs the tool and feeds the result back.

The voice runners (OpenAI Realtime, ElevenLabs) stay in the repository, unrun; they need the owner's
keys and the owner's yes for each run.

### Consequences

- Good, because the prompt, tools and scoring are tested at zero extra cost, as often as needed.
- Good, because the found failures (dates, promises) were found before any money was spent.
- Bad, because speech recognition, synthesis and latency are **not** measured; a text pass does not
  prove a voice pass. Recorded as open in `research.md`.
- Bad, because CLI timings (median 17 s per turn with Sonnet, 26 s with Haiku) include CLI start-up
  and say nothing about phone latency.
- The CLI is a development tool only; it is never the backend of the deployed demo (it runs on the
  owner's Mac, and the subscription is personal).

### Confirmation

`run-claude.mjs` exits with the pass counts; results and transcripts are kept in `out/` and
summarised in `research.md`.

## Pros and Cons of the Options

### A — `claude` CLI

- Good, because zero marginal cost and the same Claude family a production model could come from.
- Bad, because text only; slow per call.

### B — Paid APIs now

- Good, because it measures the real voice path.
- Bad, because it spends money before the owner knows whether the assignment leads anywhere.

### C — Local model

- Good, because free.
- Bad, because the owner's standing rule is not to run large local models on this machine; Czech
  quality of small local models is unmeasured and likely worse.

## More Information

`claude --help` (Claude Code 2.1.289, read 2026-11-24) for the isolation flags.
