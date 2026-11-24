import type { BakerySettings } from "@bakery/core/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { Button, colors, font, Screen } from "@/shared/ui";
import { useSaveSettings, useSettings } from "./api";
import { SettingsForm, toForm, toSettings } from "./form";
import { ProductRow } from "./ProductRow";
import { ResetDemo } from "./ResetDemo";
import { ScheduleSection } from "./ScheduleSection";

/** "Nastavení": the owner's rules — cut-off, closed days, prices, limits, buffers — and "Reset demo" (FR-011, FR-042, FR-044). */
export function SettingsScreen() {
  const { t } = useTranslation();
  const settings = useSettings();
  if (settings.isPending)
    return <ActivityIndicator style={styles.center} color={colors.primary} accessibilityLabel={t("common.loading")} />;
  if (settings.isError)
    return (
      <Screen title={t("tabs.settings")}>
        <Text style={styles.error}>{settings.error.message}</Text>
        <Button label={t("common.retry")} onPress={() => void settings.refetch()} />
      </Screen>
    );
  // Remount the form when the saved document changes (e.g. after "Reset demo").
  return <SettingsEditor key={JSON.stringify(settings.data)} settings={settings.data} />;
}

function SettingsEditor({ settings }: { settings: BakerySettings }) {
  const { t } = useTranslation();
  const save = useSaveSettings();
  const { control, handleSubmit, formState } = useForm<SettingsForm>({
    resolver: zodResolver(SettingsForm),
    defaultValues: toForm(settings),
  });
  return (
    <Screen title={t("tabs.settings")}>
      <ScheduleSection control={control} />
      <Text style={styles.heading}>{t("settings.products")}</Text>
      <Text style={styles.note}>{t("settings.priceNote")}</Text>
      {settings.products.map((p, i) => (
        <ProductRow key={p.id} control={control} index={i} name={p.name} />
      ))}
      {formState.isSubmitted && !formState.isValid ? (
        <Text style={styles.error}>{t("settings.errors.fix")}</Text>
      ) : null}
      {save.error ? <Text style={styles.error}>{save.error.message}</Text> : null}
      {save.isSuccess && !formState.isDirty ? <Text style={styles.ok}>{t("settings.saved")}</Text> : null}
      <Button
        label={t("settings.save")}
        busy={save.isPending}
        onPress={() => void handleSubmit((f) => save.mutate(toSettings(f)))()}
      />
      <ResetDemo />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  heading: { fontSize: font.label, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
  note: { fontSize: font.label, color: colors.muted },
  error: { fontSize: font.body, color: colors.danger },
  ok: { fontSize: font.body, color: "#166534", fontWeight: "600" },
});
