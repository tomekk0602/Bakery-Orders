import { afterEach, describe, expect, it, vi } from "vitest";
import { openMicrophone } from "./audio";

afterEach(() => vi.unstubAllGlobals());

describe("a failed microphone start releases the microphone (spec 001 FR-079)", () => {
  it("the worklet fails to load: the granted stream is stopped and the context closed", async () => {
    const track = { stop: vi.fn() };
    const close = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track] }) } });
    vi.stubGlobal(
      "AudioContext",
      class {
        audioWorklet = { addModule: async () => Promise.reject(new Error("worklet blocked")) };
        close = close;
      },
    );
    vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: vi.fn() });
    await expect(openMicrophone(() => undefined)).rejects.toThrow("worklet blocked");
    expect(track.stop).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
});
