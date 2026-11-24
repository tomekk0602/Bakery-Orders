---
status: superseded by ADR-0011
date: 2026-11-24
decision-makers: owner
---

# ADR-0005: The deployed demo uses cost-free voice components — the browser's speech recognition and synthesis, and a model on a free tier; realtime voice providers are the measured production path

## Context and Problem Statement

The reviewers need a running link. The voice agent needs speech-to-text, a model with tool calls,
and text-to-speech. ADR-0004 keeps development free; the demo should also not create a bill the
owner did not agree to, yet it must be good enough to show the idea in Czech.

## Decision Drivers

- No spend without the owner's yes (constitution VI).
- The demo must run without the owner's Mac (the `claude` CLI cannot be the backend, ADR-0004).
- Czech must be understood; the measurement gate decides the production provider.

## Considered Options

- A — browser Web Speech API (recognition `cs-CZ`, `speechSynthesis` with a Czech voice) +
  a model on a free API tier (Gemini Flash) with function calling, behind our server
- B — a realtime speech-to-speech provider (OpenAI Realtime) or a voice-agent platform (ElevenLabs
  Agents) from the start
- C — browser speech + a paid small model (Claude Haiku 4.5 API)

## Decision Outcome

Proposed option: **A**, with **B** kept as the production path, chosen by the voice measurement
(`spikes/czech-voice/run-openai.mjs`, `run-elevenlabs.mjs`) once the owner agrees to spend on it,
and **C** as the fallback if the free tier's Czech or tool calling fails our text suite.

Before A is accepted: run the same text suite (utterances + dialogues) against the free-tier model;
it must match the Claude results on dates (10/10 with the calendar) and dialogues.

### Consequences

- Good, because the demo costs nothing to run and nothing per reviewer call.
- Good, because the walkthrough has an honest story: cheap proof first, measurement, then spend.
- Bad, because browser speech is robotic and recognition is best in Chrome; the demo states it.
- Bad, because Chrome's recognition sends audio to Google's servers. With Gemini, the free tier's
  data terms in the EEA are the paid ones (see below), but the browser recognition is a separate
  Google service; the demo uses invented customer data only.
- Bad, because a free tier has rate limits; enough for a few reviewers, not for a shop.

### Confirmation

The text suite run against the chosen demo model is recorded in `research.md` before the demo is
built on it.

## Pros and Cons of the Options

### A — Browser speech + free-tier model

- Good, because zero cost; works with a link.
- Bad, because voice quality and latency are below a realtime provider.

### B — Realtime provider

- Good, because natural voice, barge-in, lower latency.
- Bad, because per-minute cost from the first test; unmeasured Czech.

### C — Browser speech + paid Haiku

- Good, because Haiku's behaviour is already measured (research R1–R2).
- Bad, because it is a (small) bill the owner has not agreed to.

## More Information

- Gemini API terms, read 2026-11-24 (https://aistudio.google.com/docs/terms): in the EEA,
  Switzerland and the UK, the "Paid Services" data terms apply to unpaid quota as well.
- Web Speech API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
