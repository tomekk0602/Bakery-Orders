import "server-only";
// a CommonJS module without a default export: the bundler resolves only named exports
import * as webpush from "web-push";
import { log } from "../log";

export type PushDevice = { endpoint: string; p256dh: string; auth: string };
export type PushResult = { result: "sent" } | { result: "gone" } | { result: "failed"; error: string };
export type SendPush = (device: PushDevice, payload: string) => Promise<PushResult>;

const g = globalThis as unknown as { __bakeryVapid?: boolean };

/**
 * The server's VAPID public key, or null when the keys are not set: device notifications are then off
 * and the app says so (ADR-0016). The keys are created and entered by the owner.
 */
export function vapidPublicKey(): string | null {
  const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subject } = process.env;
  if (!pub || !priv || !subject) {
    if (g.__bakeryVapid === undefined) log.info("device notifications off: VAPID keys not set");
    g.__bakeryVapid = false;
    return null;
  }
  if (!g.__bakeryVapid) {
    webpush.setVapidDetails(subject, pub, priv);
    g.__bakeryVapid = true;
  }
  return pub;
}

/** The notification sent when a device is switched on, so the person sees it works (FR-009). */
export const sendTestPush = (device: PushDevice) =>
  sendWebPush(
    device,
    JSON.stringify({
      title: "Upozornění zapnuta",
      body: "Takto se v tomto zařízení ukáže nový požadavek nebo plán.",
      link: "/upozorneni",
      tag: "test",
    }),
  );

/** Status codes that mean the browser withdrew the registration for good (RFC 8030; research N9). */
const GONE = new Set([404, 410]);

/** One Web Push message to one device; encryption and VAPID by `web-push` (RFC 8291, RFC 8292). */
export const sendWebPush: SendPush = async (device, payload) => {
  try {
    await webpush.sendNotification(
      { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
      payload,
      {
        TTL: 60 * 60,
        urgency: "high",
      },
    );
    return { result: "sent" };
  } catch (e) {
    const status = e instanceof webpush.WebPushError ? e.statusCode : undefined;
    if (status !== undefined && GONE.has(status)) return { result: "gone" };
    return {
      result: "failed",
      error: status !== undefined ? `HTTP ${status}` : e instanceof Error ? e.message : String(e),
    };
  }
};
