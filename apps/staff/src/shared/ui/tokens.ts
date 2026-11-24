/** Design tokens. Large touch targets: staff use the app with busy, often floury hands. */
export const colors = {
  background: "#FAF7F2",
  surface: "#FFFFFF",
  text: "#1C1917",
  muted: "#57534E",
  primary: "#B45309",
  primaryText: "#FFFFFF",
  danger: "#B91C1C",
  border: "#D6D3D1",
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { md: 10, lg: 16 } as const;
export const font = { body: 17, title: 26, label: 15 } as const;
/** Minimum height of anything tappable (Apple HIG recommends at least 44 pt; we go larger). */
export const TOUCH_TARGET = 56;
