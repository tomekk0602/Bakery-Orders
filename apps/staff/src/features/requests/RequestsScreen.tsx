import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { useMe } from "@/features/auth/use-me";
import { Button, colors, font, Screen } from "@/shared/ui";
import { useRequests } from "./api";
import { RequestCard } from "./RequestCard";

/** "Požadavky": callbacks, changes and cancellations waiting for a person, worked through to the end; closed ones only from today, older ones in the owner's archive (FR-008, FR-034, FR-041, FR-047–FR-053). */
export function RequestsScreen() {
  const { t } = useTranslation();
  const requests = useRequests();
  const router = useRouter();
  const canArchive = useMe().data?.permissions.includes("request:archive") ?? false;
  const [showClosed, setShowClosed] = useState(false);

  if (requests.isPending)
    return <ActivityIndicator style={styles.center} color={colors.primary} accessibilityLabel={t("common.loading")} />;
  if (requests.isError)
    return (
      <Screen title={t("tabs.requests")}>
        <Text style={styles.error}>{requests.error.message}</Text>
        <Button label={t("common.retry")} onPress={() => void requests.refetch()} />
      </Screen>
    );

  const { open, closedToday } = requests.data;

  return (
    <Screen title={t("tabs.requests")} refreshing={requests.isRefetching} onRefresh={() => void requests.refetch()}>
      {open.length === 0 ? <Text style={styles.muted}>{t("requests.none")}</Text> : null}
      {open.map((r) => (
        <RequestCard key={r.id} item={r} />
      ))}
      {closedToday.length > 0 ? (
        <Pressable accessibilityRole="button" onPress={() => setShowClosed((v) => !v)} hitSlop={8}>
          <Text style={styles.heading}>
            {showClosed ? "▾ " : "▸ "}
            {t("requests.closedToday", { count: closedToday.length })}
          </Text>
        </Pressable>
      ) : null}
      {showClosed ? closedToday.map((r) => <RequestCard key={r.id} item={r} />) : null}
      {canArchive ? (
        <Button label={t("requests.archive.open")} variant="secondary" onPress={() => router.push("/archiv")} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  error: { fontSize: font.body, color: colors.danger },
  muted: { fontSize: font.body, color: colors.muted },
  heading: { fontSize: font.label, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
});
