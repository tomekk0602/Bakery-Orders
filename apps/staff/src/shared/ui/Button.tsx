import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, font, radius, space, TOUCH_TARGET } from "./tokens";

type Props = {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary";
};

/** A pressed button dims to 80 %, an inactive one to 60 % (FR-072). */
const PRESSED_OPACITY = 0.8;
const INACTIVE_OPACITY = 0.6;

export function Button({ label, onPress, busy = false, disabled = false, variant = "primary" }: Props) {
  const inactive = disabled || busy;
  const primary = variant === "primary";
  const content = busy ? (
    <ActivityIndicator color={primary ? colors.primaryText : colors.primary} />
  ) : (
    <Text style={[styles.label, primary ? styles.primaryLabel : styles.secondaryLabel]}>{label}</Text>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.frame,
        !primary && [styles.inner, styles.secondary],
        inactive ? styles.inactive : pressed && styles.pressed,
      ]}
    >
      {primary ? (
        <LinearGradient colors={colors.primaryGradient} style={styles.inner}>
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.sm, overflow: "hidden" },
  inner: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: space.md,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pressed: { opacity: PRESSED_OPACITY },
  inactive: { opacity: INACTIVE_OPACITY },
  label: { fontSize: font.button, fontWeight: "600" },
  primaryLabel: { color: colors.primaryText },
  secondaryLabel: { color: colors.primary },
});
