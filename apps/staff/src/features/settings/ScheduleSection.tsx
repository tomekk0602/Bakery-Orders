import { Controller, useFieldArray, type Control } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, colors, font, radius, space, TextField } from "@/shared/ui";
import type { SettingsForm } from "./form";

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** Cut-off, weekly closed days and extra closed days (FR-007, FR-011, FR-038). */
export function ScheduleSection({ control }: { control: Control<SettingsForm> }) {
  const { t } = useTranslation();
  const closedDays = useFieldArray({ control, name: "closedDays" });
  const err = (key?: string) => (key ? t(key) : undefined);
  return (
    <>
      <Card>
        <Text style={styles.heading}>{t("settings.cutoff")}</Text>
        <View style={styles.row}>
          <View style={styles.half}>
            <Controller control={control} name="cutoffDaysBefore" render={({ field, fieldState }) => <TextField label={t("settings.cutoffDays")} value={field.value} onChangeText={field.onChange} keyboardType="number-pad" error={err(fieldState.error?.message)} />} />
          </View>
          <View style={styles.half}>
            <Controller control={control} name="cutoffTime" render={({ field, fieldState }) => <TextField label={t("settings.cutoffTime")} value={field.value} onChangeText={field.onChange} placeholder="14:00" error={err(fieldState.error?.message)} />} />
          </View>
        </View>
      </Card>
      <Card>
        <Text style={styles.heading}>{t("settings.closedWeekdays")}</Text>
        <Controller
          control={control}
          name="closedWeekdays"
          render={({ field, fieldState }) => (
            <>
              <View style={styles.chips}>
                {WEEKDAY_KEYS.map((key, i) => {
                  const day = i + 1;
                  const on = field.value.includes(day);
                  return (
                    <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={t(`settings.weekdays.${key}`)} onPress={() => field.onChange(on ? field.value.filter((d) => d !== day) : [...field.value, day])} style={[styles.chip, on && styles.chipOn]}>
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{t(`settings.weekdays.${key}`)}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {fieldState.error?.message ? <Text style={styles.error}>{t(fieldState.error.message)}</Text> : null}
            </>
          )}
        />
      </Card>
      <Card>
        <Text style={styles.heading}>{t("settings.closedDays")}</Text>
        {closedDays.fields.map((f, i) => (
          <View key={f.id} style={styles.closedRow}>
            <View style={styles.half}>
              <Controller control={control} name={`closedDays.${i}.day`} render={({ field, fieldState }) => <TextField label={t("settings.date")} placeholder="2026-12-31" value={field.value} onChangeText={field.onChange} error={err(fieldState.error?.message)} />} />
            </View>
            <View style={styles.half}>
              <Controller control={control} name={`closedDays.${i}.reason`} render={({ field }) => <TextField label={t("settings.reason")} value={field.value} onChangeText={field.onChange} />} />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t("settings.removeDay")} onPress={() => closedDays.remove(i)} hitSlop={8}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
        ))}
        <Button label={t("settings.addDay")} variant="secondary" onPress={() => closedDays.append({ day: "", reason: "" })} />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: font.label, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
  row: { flexDirection: "row", gap: space.sm },
  half: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { minWidth: 48, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.label, color: colors.text },
  chipTextOn: { color: colors.primaryText, fontWeight: "700" },
  closedRow: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  remove: { fontSize: font.title, color: colors.danger, paddingBottom: space.sm },
  error: { fontSize: font.label, color: colors.danger },
});
