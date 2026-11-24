#!/usr/bin/env bash
# Synthesises every utterance with the macOS Czech voice and writes raw PCM16 mono in two variants:
#   clean — straight from the voice
#   phone — band-limited through 8 kHz, like a telephone line, then back to the provider's rate
# Rates: 24 kHz for OpenAI Realtime, 16 kHz for ElevenLabs.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p audio
node -e 'for (const u of require("./utterances.json")) console.log(u.id + "\t" + u.text)' |
while IFS=$'\t' read -r id text; do
  say -v Zuzana -o "audio/$id.aiff" "$text"
  for rate in 24000 16000; do
    ffmpeg -loglevel error -y -i "audio/$id.aiff" -ac 1 -ar "$rate" -f s16le "audio/$id.clean.$rate.pcm"
    ffmpeg -loglevel error -y -i "audio/$id.aiff" -ac 1 -af "highpass=f=300,lowpass=f=3400" -ar 8000 -f wav - |
      ffmpeg -loglevel error -y -i - -ac 1 -ar "$rate" -f s16le "audio/$id.phone.$rate.pcm"
  done
  rm "audio/$id.aiff"
  echo "audio $id"
done
