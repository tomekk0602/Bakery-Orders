import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { Button, colors, font, Screen } from "@/shared/ui";
import { useOrdersForDay, useSetHandedOver } from "./api";
import { formatDay } from "./format";
import { OrderRow } from "./OrderRow";

/** "Dnes": today's orders to hand over, waiting ones first (FR-012, US4). */
export function TodayScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const orders = useOrdersForDay(null);
  const setHandedOver = useSetHandedOver();

  if (orders.isPending)
    return <ActivityIndicator style={styles.center} color={colors.primary} accessibilityLabel={t("common.loading")} />;
  if (orders.isError)
    return (
      <Screen title={t("tabs.today")}>
        <Text style={styles.error}>{orders.error.message}</Text>
        <Button label={t("common.retry")} onPress={() => void orders.refetch()} />
      </Screen>
    );

  const list = [...orders.data.orders].sort(
    (a, b) => Number(a.status === "picked_up") - Number(b.status === "picked_up") || a.number - b.number,
  );
  const waiting = list.filter((o) => o.status === "confirmed").length;

  return (
    <Screen
      title={t("orders.todayTitle", { day: formatDay(orders.data.day) })}
      refreshing={orders.isRefetching}
      onRefresh={() => void orders.refetch()}
    >
      <Text style={styles.summary}>
        {t("orders.toHandOver", { count: waiting })} · {t("orders.handedOverCount", { count: list.length - waiting })}
      </Text>
      {list.length === 0 ? <Text style={styles.summary}>{t("orders.empty")}</Text> : null}
      {list.map((order) => (
        <OrderRow
          key={order.id}
          order={order}
          onOpen={() => router.push(`/objednavka/${order.id}`)}
          onToggle={() =>
            setHandedOver.mutate({ id: order.id, status: order.status === "picked_up" ? "confirmed" : "picked_up" })
          }
          busy={setHandedOver.isPending && setHandedOver.variables?.id === order.id}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  summary: { fontSize: font.body, color: colors.muted },
  error: { fontSize: font.body, color: colors.danger },
});
