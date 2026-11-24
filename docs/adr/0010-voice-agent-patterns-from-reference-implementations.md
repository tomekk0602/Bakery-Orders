---
status: accepted
date: 2026-11-24
decision-makers: owner
---

# ADR-0010: The voice agent adopts five patterns from established voice-agent implementations: catalogue IDs as an enum, a speech vocabulary, simulated-customer tests, silence and slow-tool handling — without adopting a voice framework for the demo

## Context and Problem Statement

Before building, the owner asked (2026-11-24) what professional voice-ordering projects use, so that
the solution follows what an AI engineer is expected to know rather than invent its own ways. Our
own measurements had already shown three weak points: a misheard product ("pět kaiserek" heard as
"Pětka, Serek" and "pět kalaret" by Gemini Live, and once mapped to "5 rohlíků" — a guess),
a 20 s response in one phone-band case, and scripted tests that score correct behaviour as a
failure when the agent first asks for the name (research R4, R7).

## Decision Drivers

- Standard over invention (constitution, Engineering standard).
- The measured failures above.
- The demo stack: TypeScript, browser, Gemini Live on the free tier (ADR-0005, ADR-0006, ADR-0007).
- Zero spend during development (ADR-0004).

## Considered Options

Reference implementations read on 2026-11-24:

| Repository | Stack | What it shows |
|---|---|---|
| livekit/agents `examples/drive_thru` | Python, LiveKit Agents (WebRTC, SIP), Deepgram nova-3 STT, Gemma LLM, Inworld TTS | menu in the instructions; item IDs as `enum` in tool schemas; tool descriptions that say when **not** to call; STT `keyterm` list of menu words; `user_away_timeout`; simulated-customer scenarios with an `expected_order` checked in code, plus `unavailable_items` and `failing_tools` |
| pipecat-ai/pipecat + Pipecat Flows (`restaurant_reservation`, food ordering) | Python, STT→LLM→TTS pipeline, Flows state machine | the conversation as nodes, each with its own tools |
| openai/openai-realtime-agents | Next.js, TypeScript, OpenAI Agents SDK, Realtime API in the browser | "chat-supervisor": a fast realtime model talks, a stronger text model decides; handoffs |
| google-gemini/live-api-web-console | React, browser WebSocket to Gemini Live, ephemeral tokens | the browser-to-Live architecture we chose; tool calls handled by app code |
| Twilio + OpenAI Realtime samples (Node, Fastify) | Twilio Media Streams | a real phone number in front of the same agent |

Options for us:

- A — adopt the patterns, keep our own thin browser client (Gemini Live starter shape)
- B — build the demo on a voice framework (LiveKit Agents or Pipecat)
- C — keep our current design unchanged

## Decision Outcome

Chosen option: **A** (owner, 2026-11-24). Adopted:

1. **Catalogue IDs as an `enum` in the tool schema.** `prepare_order.items[].product_id` is an
   enum of the active catalogue IDs, generated per session from the database. An ID outside the
   catalogue becomes impossible by schema, not by prompt. The server still validates (ADR-0003).
2. **Tool descriptions that say when not to call.** E.g. `prepare_order`: "Never infer a product
   the customer did not name clearly; if a word does not match a product, ask." This is the
   drive-thru's "never infer or assume the drink" applied to our catalogue.
3. **A speech vocabulary from the catalogue.** Product names (and their inflected forms:
   "kaiserka/kaiserek/kaiserky") are passed to the recogniser (Gemini Live input transcription
   custom vocabulary; the device recogniser's contextual strings in the staff app where available).
   Re-measured on the "kaiserek" case before it is relied on.
4. **Simulated-customer tests.** In addition to the scripted utterances: a model plays a Czech
   customer from a goal ("order two rye breads for Friday, then change it to three"), the agent
   talks to it, and at the end **code** compares the saved order with `expected_order`. Scenarios
   also cover an unavailable product and a tool that fails. The simulated customer runs through the
   `claude` CLI (Sonnet 5.5) at no extra cost (ADR-0004).
5. **Silence and slow tools.** After a silence the agent asks "Jste tam ještě?" and ends the call
   politely after a second silence; when a tool has not answered quickly, the agent says "Moment,
   ověřuji" instead of staying silent. Both thresholds are taken from the reference (LiveKit uses
   10 s in the example, 15 s by default) and are **unmeasured for us** — debt until timed in the
   demo.

Not adopted for the demo:

- **A voice framework (B).** LiveKit Agents and Pipecat need a long-running server process (Python,
  or Node for LiveKit's JS agents); our hosting is serverless (ADR-0007) and the browser connects to
  Gemini Live directly (ADR-0006). They are the **production path for a real phone number** —
  LiveKit has SIP telephony — and the README says so.
- **Pipecat Flows' explicit state machine.** Our conversation has one goal and four facts (items,
  day, name, confirmation); the code-side checks of ADR-0003 already enforce the order of steps.
  Revisited if scenarios show the agent skipping steps.
- **Chat-supervisor.** A second model adds latency on every decision; revisited only if the
  scenario tests show the realtime model making decisions a text model gets right.

### Consequences

- Good, because the walkthrough can show that the design follows established practice and why each
  part was or was not taken.
- Good, because points 1–3 directly target the measured misheard product, and 4 fixes the tests that
  scored correct behaviour as a failure.
- Bad, because simulated-customer tests are slower and non-deterministic; the final order check is
  deterministic, the conversation is not, so each scenario is run several times before a rate is
  quoted.

### Confirmation

- Tests that must fail if a rule is removed: a `prepare_order` with an ID outside the enum is
  rejected by the schema validator and by the server; the scenario suite fails when the saved order
  differs from `expected_order`; a scenario with a failing tool fails if the agent claims success.
- The "kaiserek" case is re-run with the vocabulary; the result goes into `research.md`.

## Pros and Cons of the Options

### A — Patterns, own thin client

- Good, because it fits the free-tier browser architecture and the TypeScript stack.
- Bad, because we write the client glue ourselves (small, following the official starter).

### B — Voice framework

- Good, because turn detection, interruptions, telephony and testing tools come ready.
- Bad, because a server process to host, Python for most examples, more to learn in a few evenings.

### C — Unchanged

- Bad, because the measured weak points stay.

## More Information

- https://github.com/livekit/agents/tree/main/examples/drive_thru (`agent.py`, `scenarios.yaml`,
  `simulation.py`, read 2026-11-24)
- https://github.com/pipecat-ai/pipecat (examples/flows), https://docs.pipecat.ai/pipecat-flows/examples
- https://github.com/openai/openai-realtime-agents
- https://github.com/google-gemini/live-api-web-console
- https://github.com/thecmdrunner/speech-assistant-openai-realtime-api-node
- Related: ADR-0003 (amended by points 1–2), ADR-0004 (simulated customer on the CLI), ADR-0005,
  ADR-0006.
