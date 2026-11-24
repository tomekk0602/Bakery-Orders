import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text } from "react-native";
import { Button, Card, colors, font } from "@/shared/ui";
import { useResetDemo } from "./api";

/** "Reset demo" (FR-042): two taps, because it removes every order, call and request. */
export function ResetDemo() {
  const { t } = useTranslation();
  const reset = useResetDemo();
  const [armed, setArmed] = useState(false);
  return (
    <Card>
      <Text style={styles.heading}>{t("settings.reset.title")}</Text>
      <Text style={styles.text}>{t("settings.reset.explain")}</Text>
      {reset.isSuccess ? <Text style={styles.ok}>{t("settings.reset.done")}</Text> : null}
      {reset.error ? <Text style={styles.error}>{reset.error.message}</Text> : null}
      {armed ? (
        <>
          <Button
            label={t("settings.reset.confirm")}
            busy={reset.isPending}
            onPress={() => reset.mutate(undefined, { onSettled: () => setArmed(false) })}
          />
          <Button
            label={t("settings.reset.cancel")}
            variant="secondary"
            onPress={() => setArmed(false)}
            disabled={reset.isPending}
          />
        </>
      ) : (
        <Button label={t("settings.reset.start")} variant="secondary" onPress={() => setArmed(true)} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: font.label, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
  text: { fontSize: font.body, color: colors.text },
  ok: { fontSize: font.body, color: "#166534", fontWeight: "600" },
  error: { fontSize: font.body, color: colors.danger },
});
