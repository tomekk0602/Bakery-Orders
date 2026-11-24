// Audio plumbing for the browser call: microphone → 16 kHz PCM16 chunks, and 24 kHz PCM16 playback.
// Formats are the Live API's: input 16-bit PCM 16 kHz, output 16-bit PCM 24 kHz (research R7).

export const INPUT_RATE = 16000;
export const OUTPUT_RATE = 24000;
/** 100 ms per chunk sent to the model, the same pacing the measurements used. */
const CHUNK_SAMPLES = INPUT_RATE / 10;
/** RMS above which a microphone chunk counts as speech, for the first-audio timer. Unmeasured. */
export const SPEECH_RMS = 0.02;

const WORKLET = `
class Capture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor("capture", Capture);
`;

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export type Microphone = { stop: () => void };

/** Opens the microphone with echo cancellation (FR-037) and calls onChunk with base64 PCM16 every 100 ms. */
export async function openMicrophone(onChunk: (base64: string, rms: number) => void): Promise<Microphone> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const ctx = new AudioContext({ sampleRate: INPUT_RATE });
  const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const node = new AudioWorkletNode(ctx, "capture");
  ctx.createMediaStreamSource(stream).connect(node);

  let buf = new Float32Array(CHUNK_SAMPLES);
  let fill = 0;
  node.port.onmessage = (e: MessageEvent<Float32Array>) => {
    for (const sample of e.data) {
      buf[fill++] = sample;
      if (fill === CHUNK_SAMPLES) {
        const pcm = new Int16Array(CHUNK_SAMPLES);
        let sum = 0;
        for (let i = 0; i < CHUNK_SAMPLES; i++) {
          const v = Math.max(-1, Math.min(1, buf[i] ?? 0));
          sum += v * v;
          pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
        }
        onChunk(toBase64(new Uint8Array(pcm.buffer)), Math.sqrt(sum / CHUNK_SAMPLES));
        buf = new Float32Array(CHUNK_SAMPLES);
        fill = 0;
      }
    }
  };
  return {
    stop: () => {
      node.port.onmessage = null;
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}

export type Speaker = { play: (base64: string) => void; interrupt: () => void; close: () => void };

/** Plays PCM16 chunks back to back; interrupt() drops what is queued when the caller talks over it. */
export function openSpeaker(): Speaker {
  const ctx = new AudioContext({ sampleRate: OUTPUT_RATE });
  let next = 0;
  const playing = new Set<AudioBufferSourceNode>();
  return {
    play(base64) {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const pcm = new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
      const buffer = ctx.createBuffer(1, pcm.length, OUTPUT_RATE);
      const ch = buffer.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) ch[i] = (pcm[i] ?? 0) / 0x8000;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      next = Math.max(next, ctx.currentTime);
      src.start(next);
      next += buffer.duration;
      playing.add(src);
      src.onended = () => playing.delete(src);
    },
    interrupt() {
      for (const s of playing) s.stop();
      playing.clear();
      next = 0;
    },
    close() {
      this.interrupt();
      void ctx.close();
    },
  };
}
