import type { StaffOrder } from "@bakery/core/contracts";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Badge, Button, Card, colors, font, space } from "@/shared/ui";
import { formatCzk, itemsSummary } from "./format";

type Props = { order: StaffOrder; onOpen: () => void; onToggle: () => void; busy: boolean };

/** One order in the day's list. The summary opens the detail; the hand-over button sits beside it, not inside. */
export function OrderRow({ order, onOpen, onToggle, busy }: Props) {
  const { t } = useTranslation();
  const handedOver = order.status === "picked_up";
  return (
    <Card muted={handedOver}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("orders.open", { number: order.number })}
        onPress={onOpen}
        style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
      >
        <View style={styles.top}>
          <Text style={styles.name}>{order.customerName}</Text>
          <Text style={styles.total}>{formatCzk(order.totalCzk)}</Text>
        </View>
        <Text style={styles.items}>{itemsSummary(order)}</Text>
        <View style={styles.meta}>
          <Badge label={`č. ${order.number}`} />
          <Badge label={t(`orders.source.${order.source}`)} />
          {handedOver ? <Badge label={t("orders.handedOver")} tone="success" /> : null}
        </View>
      </Pressable>
      <Button
        label={handedOver ? t("orders.undoHandOver") : t("orders.handOver")}
        variant={handedOver ? "secondary" : "primary"}
        onPress={onToggle}
        busy={busy}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: { gap: space.sm },
  pressed: { opacity: 0.7 },
  top: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  name: { fontSize: font.body + 2, fontWeight: "700", color: colors.text, flexShrink: 1 },
  total: { fontSize: font.body, fontWeight: "600", color: colors.text },
  items: { fontSize: font.body, color: colors.text },
  meta: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
});
