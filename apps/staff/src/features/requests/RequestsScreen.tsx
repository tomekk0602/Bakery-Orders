import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { Button, colors, font, Screen } from "@/shared/ui";
import { useRequests, useSetRequestDone } from "./api";
import { RequestCard } from "./RequestCard";

/** "Požadavky": callbacks, changes and cancellations waiting for a person (FR-008, FR-034, FR-041). */
export function RequestsScreen() {
  const { t } = useTranslation();
  const requests = useRequests();
  const setDone = useSetRequestDone();

  if (requests.isPending) return <ActivityIndicator style={styles.center} color={colors.primary} accessibilityLabel={t("common.loading")} />;
  if (requests.isError)
    return (
      <Screen title={t("tabs.requests")}>
        <Text style={styles.error}>{requests.error.message}</Text>
        <Button label={t("common.retry")} onPress={() => void requests.refetch()} />
      </Screen>
    );

  const { open, done } = requests.data;
  const toggle = (id: string, isDone: boolean) => setDone.mutate({ id, done: !isDone });
  const busy = (id: string) => setDone.isPending && setDone.variables?.id === id;

  return (
    <Screen title={t("tabs.requests")} refreshing={requests.isRefetching} onRefresh={() => void requests.refetch()}>
      {open.length === 0 ? <Text style={styles.muted}>{t("requests.none")}</Text> : null}
      {open.map((r) => (
        <RequestCard key={r.id} item={r} busy={busy(r.id)} onToggle={() => toggle(r.id, false)} />
      ))}
      {done.length > 0 ? <Text style={styles.heading}>{t("requests.handled")}</Text> : null}
      {done.map((r) => (
        <RequestCard key={r.id} item={r} busy={busy(r.id)} onToggle={() => toggle(r.id, true)} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  error: { fontSize: font.body, color: colors.danger },
  muted: { fontSize: font.body, color: colors.muted },
  heading: { fontSize: font.label, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
});
