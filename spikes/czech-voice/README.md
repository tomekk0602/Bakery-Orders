# Spike: Czech voice quality — OpenAI Realtime vs ElevenLabs Agents

Measurement gate of `specs/001-voice-ordering` (results and decisions in its `research.md`). Ten scripted Czech customer utterances
(`utterances.json`) are synthesised with the macOS Czech voice, in a clean and a phone-band
variant, streamed in real time to each provider with the same instructions and tools
(`common.mjs`), and scored on the `prepare_order` / `request_callback` tool calls.

Measured per utterance: pass/fail, latency from the end of speech to the first audio of the
answer, what the provider heard, what it said back. Reply audio lands in `out/audio/` for listening.

Limits: a synthetic voice is cleaner than a real caller; one run per utterance gives no spread.
A few recordings of real voices would be the next step.

## Text-only run (no API key, no spend — ADR-0004)

```bash
npm install
node run-claude.mjs                 # Sonnet 5.5 through the claude CLI
node run-claude.mjs claude-haiku-4-5-20251001
```

Same instructions, tools and scoring, plus the multi-turn dialogues in `dialogs.json`; voice is
not tested.

## Gemini free tier (needs `GEMINI_API_KEY` in `.env`, no spend — ADR-0011)

```bash
LABEL=vocab VOCABULARY=1 node --env-file=.env run-gemini-live.mjs clean   # or phone
node --env-file=.env run-transcribe.mjs clean                             # Transcribe Live, ± vocabulary
GEMINI_RPM=13 node --env-file=.env run-claude.mjs gemini-3.5-flash-lite   # text suite, paced to the free limit
```

## Voice run (paid — only with the owner's yes)

```bash
# create .env yourself with OPENAI_API_KEY=… and ELEVENLABS_API_KEY=…
# optional: OPENAI_REALTIME_MODEL, OPENAI_VOICE, ELEVENLABS_LLM, ELEVENLABS_TTS_MODEL
npm install
./make-audio.sh
node --env-file=.env run-openai.mjs clean
node --env-file=.env run-openai.mjs phone
node --env-file=.env run-elevenlabs.mjs clean
node --env-file=.env run-elevenlabs.mjs phone
```
