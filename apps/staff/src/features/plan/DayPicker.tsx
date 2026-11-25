import type { PlanDay } from "@bakery/core/contracts";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { colors, font, radius, space, TOUCH_TARGET } from "@/shared/ui";
import { formatDay } from "@/features/orders/format";

type Props = { days: PlanDay[]; selected: string; onSelect: (date: string) => void };

/** A row of days to switch the plan to; closed days are shown but marked. */
export function DayPicker({ days, selected, onSelect }: Props) {
  const { t } = useTranslation();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {days.map((d) => {
        const active = d.date === selected;
        const label = d.relative ? t(`plan.relative.${d.relative}`) : formatDay(d.date);
        return (
          <Pressable
            key={d.date}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${label}${d.closed ? `, ${t("plan.closed")}` : ""}`}
            onPress={() => onSelect(d.date)}
            style={[styles.chip, active && styles.active, d.closed && styles.closed]}
          >
            <Text style={[styles.text, active && styles.activeText]}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm },
  chip: {
    minHeight: TOUCH_TARGET,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  active: { backgroundColor: colors.primary, borderColor: colors.primary },
  closed: { opacity: 0.5 },
  text: { fontSize: font.label, color: colors.text },
  activeText: { color: colors.primaryText, fontWeight: "700" },
});
