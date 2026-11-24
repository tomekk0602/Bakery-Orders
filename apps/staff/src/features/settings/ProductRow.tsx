import { Controller, type Control } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Card, colors, font, radius, space, TextField } from "@/shared/ui";
import type { SettingsForm } from "./form";

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

type Props = { control: Control<SettingsForm>; index: number; name: string };

/** One product: price, daily limit, offered or not, and the walk-in buffer per weekday (FR-011). */
export function ProductRow({ control, index, name }: Props) {
  const { t } = useTranslation();
  const err = (key?: string) => (key ? t(key) : undefined);
  return (
    <Card>
      <View style={styles.head}>
        <Text style={styles.name}>{name}</Text>
        <Controller control={control} name={`products.${index}.active`} render={({ field }) => <Switch accessibilityLabel={t("settings.active", { product: name })} value={field.value} onValueChange={field.onChange} />} />
      </View>
      <View style={styles.row}>
        <View style={styles.half}>
          <Controller control={control} name={`products.${index}.priceCzk`} render={({ field, fieldState }) => <TextField label={t("settings.price")} accessibilityLabel={t("settings.priceOf", { product: name })} value={field.value} onChangeText={field.onChange} keyboardType="number-pad" error={err(fieldState.error?.message)} />} />
        </View>
        <View style={styles.half}>
          <Controller control={control} name={`products.${index}.dailyLimit`} render={({ field, fieldState }) => <TextField label={t("settings.limit")} accessibilityLabel={t("settings.limitOf", { product: name })} placeholder={t("settings.noLimit")} value={field.value} onChangeText={field.onChange} keyboardType="number-pad" error={err(fieldState.error?.message)} />} />
        </View>
      </View>
      <Text style={styles.label}>{t("settings.buffers")}</Text>
      <View style={styles.week}>
        {WEEKDAY_KEYS.map((key, day) => (
          <View key={key} style={styles.day}>
            <Text style={styles.dayLabel}>{t(`settings.weekdays.${key}`)}</Text>
            <Controller
              control={control}
              name={`products.${index}.buffers.${day}`}
              render={({ field, fieldState }) => (
                <TextInput accessibilityLabel={t("settings.bufferOf", { product: name, day: t(`settings.weekdays.${key}`) })} value={field.value} onChangeText={field.onChange} keyboardType="number-pad" style={[styles.small, fieldState.error && styles.invalid]} />
              )}
            />
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: font.body + 2, fontWeight: "700", color: colors.text },
  row: { flexDirection: "row", gap: space.sm },
  half: { flex: 1 },
  label: { fontSize: font.label, color: colors.muted, fontWeight: "600" },
  week: { flexDirection: "row", gap: space.xs },
  day: { flex: 1, alignItems: "center", gap: 2 },
  dayLabel: { fontSize: font.label - 2, color: colors.muted },
  small: { width: "100%", minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, textAlign: "center", fontSize: font.body, color: colors.text, backgroundColor: colors.surface },
  invalid: { borderColor: colors.danger },
});
