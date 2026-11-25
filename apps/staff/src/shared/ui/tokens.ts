/** Design tokens. Sizes of controls: spec 001 FR-072, research R41. */
export const colors = {
  background: "#FAF7F2",
  surface: "#FFFFFF",
  text: "#1C1917",
  muted: "#57534E",
  primary: "#B45309",
  /** The main button, top to bottom; the label sits on the middle stop (research R41). */
  primaryGradient: ["#D97706", "#B45309", "#92400E"],
  primaryText: "#FFFFFF",
  danger: "#B91C1C",
  border: "#D6D3D1",
  /** The selected tab's pill (research R42). */
  tabActive: "#FDE8D0",
  /** Over the blur; nearly opaque where blur is weak (Android), so labels stay legible. */
  glass: "rgba(255, 255, 255, 0.72)",
  glassOpaque: "rgba(255, 255, 255, 0.96)",
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 10, lg: 16 } as const;
export const font = { body: 17, button: 16, title: 26, label: 15 } as const;
/** Minimum size of anything tappable: the Apple Human Interface Guidelines minimum for a finger. */
export const TOUCH_TARGET = 44;
/** Widest page content; wider screens centre it (FR-073). */
export const CONTENT_MAX_WIDTH = 720;
/** Icons of the tab bar and the header — one set, one size (FR-075). */
export const ICON_SIZE = 22;
/** The floating tab bar: its height, its distance from the screen edges, its widest (FR-074). */
export const TAB_BAR = { height: 64, inset: 12, maxWidth: 560 } as const;
