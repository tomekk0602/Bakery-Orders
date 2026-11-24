import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font, radius, space, TOUCH_TARGET } from "@/shared/ui";

type Props = { label: string; value: number; onStep: (delta: 1 | -1) => void; max?: number };

/**
 * − value + with large targets. It reports a step, not a new value: two quick taps must give +2,
 * and a value computed from the last render would give +1.
 */
export function QuantityStepper({ label, value, onStep, max = 200 }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t("newOrder.less", { product: label })} disabled={value === 0} onPress={() => onStep(-1)} style={[styles.btn, value === 0 && styles.off]}>
        <Text style={styles.sign}>−</Text>
      </Pressable>
      <Text style={[styles.value, value > 0 && styles.on]} accessibilityLabel={t("newOrder.quantityOf", { product: label, count: value })}>
        {value}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t("newOrder.more", { product: label })} disabled={value >= max} onPress={() => onStep(1)} style={styles.btn}>
        <Text style={styles.sign}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  label: { flex: 1, fontSize: font.body, color: colors.text },
  btn: { width: TOUCH_TARGET, height: TOUCH_TARGET - 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  off: { opacity: 0.4 },
  sign: { fontSize: font.title, color: colors.primary, lineHeight: font.title + 2 },
  value: { width: 40, textAlign: "center", fontSize: font.body, color: colors.muted, fontVariant: ["tabular-nums"] },
  on: { color: colors.text, fontWeight: "700" },
});
