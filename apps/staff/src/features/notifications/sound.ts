/**
 * The banner's sound outside a browser: the native build has no audio library yet (spec 002 FR-023,
 * research N15), so a native app shows banners without sound and the settings say so.
 */
export const soundSupported = false;
export const isSoundOn = (): boolean => false;
export const setSoundOn = (_on: boolean): void => {};
export const unlockSoundOnFirstTouch = (): void => {};
export const playChime = (): void => {};
