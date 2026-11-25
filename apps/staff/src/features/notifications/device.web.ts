import Constants from "expo-constants";
import { registerDevice, unregisterDevice } from "./api";
import type { DeviceSupport } from "./device";

export type { DeviceSupport } from "./device";

/** The web build is served under `/staff` (research R28); the worker's scope is the app's own path (N5). */
const base = (Constants.expoConfig?.experiments?.baseUrl ?? "").replace(/\/$/, "");
const WORKER_URL = `${base}/sw.js`;
const SCOPE = `${base}/`;

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * Web Push needs a Service Worker and the Push API; Safari on iPhone offers them only to an app added
 * to the home screen (iOS 16.4+), so that case gets its own hint (spec 002 FR-013).
 */
export function deviceSupport(): DeviceSupport {
  const apis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (apis) return "supported";
  return isIos() && !isStandalone() ? "ios_home_screen" : "unsupported";
}

/** The VAPID key as the Push API wants it: base64url → bytes. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const registration = () => navigator.serviceWorker.getRegistration(SCOPE);

export async function currentEndpoint(): Promise<string | null> {
  if (deviceSupport() !== "supported") return null;
  const sub = await (await registration())?.pushManager.getSubscription();
  return sub?.endpoint ?? null;
}

/** Asks for permission, subscribes this browser and registers it with the server (FR-009). */
export async function enableDevice(vapidPublicKey: string): Promise<{ testSent: boolean }> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("denied");
  const reg = await navigator.serviceWorker.register(WORKER_URL, { scope: SCOPE });
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidPublicKey) }));
  return registerDevice({ ...sub.toJSON(), userAgent: navigator.userAgent.slice(0, 300) });
}

/** Turns notifications off on this device: the server forgets it, the browser drops it (FR-012). */
export async function disableDevice(): Promise<void> {
  const sub = await (await registration())?.pushManager.getSubscription();
  if (!sub) return;
  // signing out must not fail on an unreachable server; a device it still holds is dropped on the next 404/410 (N9)
  await unregisterDevice(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe();
}

/**
 * Links the web app manifest, so "Add to Home Screen" makes a standalone app — on iPhone the only way to
 * get Web Push (FR-013). The single-page build has no HTML template of ours, so it is added at start.
 */
export function linkManifest(): void {
  if (document.querySelector('link[rel="manifest"]')) return;
  const link = document.createElement("link");
  link.rel = "manifest";
  link.href = `${base}/manifest.webmanifest`;
  document.head.appendChild(link);
}

/**
 * The Service Worker hands a push to a visible window instead of showing a system notification
 * (FR-026, research N14); the window then reads the list at once and shows the banner.
 */
export function onPushMessage(handler: () => void): () => void {
  if (!("serviceWorker" in navigator)) return () => {};
  const listener = (event: MessageEvent) => {
    if ((event.data as { type?: string } | null)?.type === "notification") handler();
  };
  navigator.serviceWorker.addEventListener("message", listener);
  return () => navigator.serviceWorker.removeEventListener("message", listener);
}
