import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, font, radius, space } from "./tokens";

/**
 * A surface for one item. It is never itself pressable: a card often holds buttons, and a button
 * inside a button is invalid on the web ("<button> cannot contain a nested <button>"). Put a
 * Pressable around the part that opens something instead.
 */
export function Card({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return <View style={[styles.card, muted && styles.muted]}>{children}</View>;
}

const TONES = {
  neutral: { bg: "#F5F5F4", fg: colors.muted },
  success: { bg: "#DCFCE7", fg: "#166534" },
  warning: { bg: "#FEF3C7", fg: "#92400E" },
} as const;

/** A short status label. */
export function Badge({ label, tone = "neutral" }: { label: string; tone?: keyof typeof TONES }) {
  return (
    <View style={[styles.badge, { backgroundColor: TONES[tone].bg }]}>
      <Text style={[styles.badgeText, { color: TONES[tone].fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: space.sm },
  muted: { opacity: 0.65 },
  badge: { alignSelf: "flex-start", borderRadius: radius.md, paddingHorizontal: space.sm, paddingVertical: 2 },
  badgeText: { fontSize: font.label, fontWeight: "600" },
});
