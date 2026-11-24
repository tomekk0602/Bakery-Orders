import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { Button, Card, colors, font, space } from "@/shared/ui";
import { useCancelOrder } from "./api";

/**
 * Cancelling asks twice, in the screen itself: a cancel cannot be undone and gives the bread back to
 * the day's limits (FR-013). No system dialog — it does nothing in the web build.
 */
export function CancelOrder({ id }: { id: string }) {
  const { t } = useTranslation();
  const cancel = useCancelOrder();
  const [asking, setAsking] = useState(false);

  if (!asking) return <Button label={t("orders.cancel")} variant="secondary" onPress={() => setAsking(true)} />;
  return (
    <Card>
      <Text style={styles.question}>{t("orders.cancelQuestion")}</Text>
      <Text style={styles.hint}>{t("orders.cancelHint")}</Text>
      {cancel.error ? <Text style={styles.error}>{cancel.error.message}</Text> : null}
      <View style={styles.actions}>
        <Button label={t("orders.cancelYes")} busy={cancel.isPending} onPress={() => cancel.mutate(id)} />
        <Button label={t("orders.cancelNo")} variant="secondary" onPress={() => setAsking(false)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  question: { fontSize: font.body + 1, fontWeight: "700", color: colors.text },
  hint: { fontSize: font.label, color: colors.muted },
  error: { fontSize: font.body, color: colors.danger },
  actions: { gap: space.sm },
});
