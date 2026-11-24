import type { StaffOrderDetail } from "@bakery/core/contracts";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";
import { Badge, Button, Card, colors, font, Screen, space } from "@/shared/ui";
import { useOrder, useSetHandedOver } from "./api";
import { formatCzk, formatDay } from "./format";

/** One order: items and prices, the customer, and for phone orders what was said on the call (FR-012). */
export function OrderDetailScreen({ id }: { id: string }) {
  const { t } = useTranslation();
  const order = useOrder(id);
  const setHandedOver = useSetHandedOver();

  if (order.isPending) return <ActivityIndicator style={styles.center} color={colors.primary} accessibilityLabel={t("common.loading")} />;
  if (order.isError)
    return (
      <Screen>
        <Text style={styles.error}>{order.error.message}</Text>
        <Button label={t("common.retry")} onPress={() => void order.refetch()} />
      </Screen>
    );

  const o = order.data;
  const handedOver = o.status === "picked_up";
  return (
    <Screen title={t("orders.number", { number: o.number })}>
      <View style={styles.row}>
        <Badge label={t(`orders.source.${o.source}`)} />
        <Badge label={t(`orders.${handedOver ? "handedOver" : o.status}`)} tone={handedOver ? "success" : o.status === "cancelled" ? "warning" : "neutral"} />
      </View>
      <Card>
        <Text style={styles.name}>{o.customerName}</Text>
        <Text style={styles.text}>{t("orders.pickup", { day: formatDay(o.pickupDay) })}</Text>
        {o.customerPhone ? (
          <Button label={t("orders.call", { phone: o.customerPhone })} variant="secondary" onPress={() => void Linking.openURL(`tel:${o.customerPhone}`)} />
        ) : (
          <Text style={styles.muted}>{t("orders.noPhone")}</Text>
        )}
      </Card>
      <Lines order={o} />
      {o.status !== "cancelled" ? (
        <Button
          label={handedOver ? t("orders.undoHandOver") : t("orders.handOver")}
          variant={handedOver ? "secondary" : "primary"}
          busy={setHandedOver.isPending}
          onPress={() => setHandedOver.mutate({ id: o.id, status: handedOver ? "confirmed" : "picked_up" })}
        />
      ) : null}
      {o.transcript ? <Transcript turns={o.transcript} /> : null}
    </Screen>
  );
}

function Lines({ order }: { order: StaffOrderDetail }) {
  const { t } = useTranslation();
  return (
    <Card>
      <Text style={styles.heading}>{t("orders.items")}</Text>
      {order.lines.map((l) => (
        <View key={l.productId} style={styles.line}>
          <Text style={styles.text}>
            {l.quantity}× {l.name}
          </Text>
          <Text style={styles.text}>{formatCzk(l.quantity * l.unitPriceCzk)}</Text>
        </View>
      ))}
      <Text style={styles.total}>{t("orders.total", { total: formatCzk(order.totalCzk) })}</Text>
    </Card>
  );
}

function Transcript({ turns }: { turns: NonNullable<StaffOrderDetail["transcript"]> }) {
  const { t } = useTranslation();
  return (
    <Card>
      <Text style={styles.heading}>{t("orders.transcript")}</Text>
      {turns.map((turn, i) => (
        <View key={i} style={[styles.bubble, turn.role === "agent" ? styles.agent : styles.customer]}>
          <Text style={styles.who}>{t(turn.role === "agent" ? "orders.agentSaid" : "orders.customerSaid")}</Text>
          <Text style={styles.text}>{turn.text}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  row: { flexDirection: "row", gap: space.sm },
  name: { fontSize: font.body + 2, fontWeight: "700", color: colors.text },
  heading: { fontSize: font.label, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
  text: { fontSize: font.body, color: colors.text },
  muted: { fontSize: font.body, color: colors.muted },
  error: { fontSize: font.body, color: colors.danger },
  line: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  total: { fontSize: font.body, fontWeight: "700", color: colors.text, textAlign: "right" },
  bubble: { borderRadius: space.sm, padding: space.sm, gap: 2 },
  agent: { backgroundColor: "#FEF3C7" },
  customer: { backgroundColor: "#F5F5F4" },
  who: { fontSize: font.label - 2, color: colors.muted },
});
