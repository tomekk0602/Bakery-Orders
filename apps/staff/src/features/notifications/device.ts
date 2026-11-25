/**
 * Device notifications outside a browser: native push is deferred (ADR-0016 D4, research N10), so on a
 * phone app this reports "unsupported" and the screen says the in-app list is what works there.
 */
export type DeviceSupport = "supported" | "unsupported" | "ios_home_screen";

export const deviceSupport = (): DeviceSupport => "unsupported";
export const currentEndpoint = async (): Promise<string | null> => null;
export const enableDevice = async (_vapidPublicKey: string): Promise<{ testSent: boolean }> => {
  throw new Error("unsupported");
};
export const disableDevice = async (): Promise<void> => {};

/** The web app manifest is a web concern; nothing to link in a native app. */
export const linkManifest = (): void => {};

/** A push received while the app is visible; nothing reaches a native app this way. */
export const onPushMessage =
  (_handler: () => void): (() => void) =>
  () => {};
