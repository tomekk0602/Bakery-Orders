import { describe, expect, it } from "vitest";
import { FirstAudioClock } from "./first-audio";

describe("first-audio latency (FR-032)", () => {
  it("measures from the end of the customer's speech to the agent's first audio", () => {
    const c = new FirstAudioClock();
    c.speech(1000);
    c.speech(1800); // still speaking: the clock follows the last speech chunk
    c.agentAudio(3600);
    c.agentAudio(3700); // the rest of the same reply is not a new sample
    expect(c.samples).toEqual([1800]);
  });

  it("ignores the agent's own voice heard through the speaker (the 2–68 ms samples in production)", () => {
    const c = new FirstAudioClock();
    c.speech(1000);
    c.agentAudio(3000);
    c.speech(3010); // echo of the reply
    c.agentAudio(3012);
    c.speech(3050);
    c.agentAudio(3100);
    expect(c.samples).toEqual([2000]);
  });

  it("measures the next turn after the agent finished or was interrupted", () => {
    const c = new FirstAudioClock();
    c.speech(0);
    c.agentAudio(2000);
    c.agentTurnEnded();
    c.speech(5000);
    c.agentAudio(6500);
    c.agentTurnEnded(); // interrupted
    c.speech(7000);
    c.agentAudio(9000);
    expect(c.samples).toEqual([2000, 1500, 2000]);
  });

  it("does not count the greeting, which no speech preceded", () => {
    const c = new FirstAudioClock();
    c.agentAudio(500);
    expect(c.samples).toEqual([]);
  });

  it("drops a gap longer than a minute (the customer went silent, then the agent spoke)", () => {
    const c = new FirstAudioClock();
    c.speech(0);
    c.agentAudio(61_000);
    expect(c.samples).toEqual([]);
  });
});
