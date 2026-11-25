import { describe, expect, it } from "vitest";
import { isPushServiceUrl, PushSubscriptionBody } from "./notifications.ts";

describe("device registration accepts only the browsers' push services (spec 002 FR-027)", () => {
  it("Chrome, Firefox, Safari and Edge endpoints", () => {
    for (const ok of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/QGabc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ])
      expect(isPushServiceUrl(ok)).toBe(true);
  });

  it("anything a user could aim at an internal or chosen address is refused", () => {
    for (const bad of [
      "https://127.0.0.1:8443/internal",
      "https://localhost/push",
      "https://10.0.0.5/push",
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com:8443/fcm/send/abc",
      "https://fcm.googleapis.com.evil.example/abc",
      "https://evilpush.apple.com.example/abc",
      "https://user:pw@fcm.googleapis.com/abc",
      "not a url",
    ])
      expect(isPushServiceUrl(bad)).toBe(false);
    expect(
      PushSubscriptionBody.safeParse({ endpoint: "https://127.0.0.1:8443/internal", keys: { p256dh: "p", auth: "a" } })
        .success,
    ).toBe(false);
  });
});
