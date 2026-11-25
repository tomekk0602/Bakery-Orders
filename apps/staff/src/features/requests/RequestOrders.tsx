import type { RequestOrder, StaffRequestItem } from "@bakery/core/contracts";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { formatCzk, formatDay, itemsSummary } from "@/features/orders/format";
import { Button, colors, font, space } from "@/shared/ui";
import { useCancelFromRequest } from "./api";

/**
 * The customer's upcoming orders for a cancel or change request (spec 001 FR-052). A cancellation is
 * done here — asked twice, like on the order — and closes the request; a change opens the order.
 */
export function RequestOrders({ item }: { item: StaffRequestItem }) {
  const { t } = useTranslation();
  if (!item.customerPhone) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>{t("requests.orders")}</Text>
      {item.orders.length === 0 ? <Text style={styles.muted}>{t("requests.noOrders")}</Text> : null}
      {item.orders.map((o) => (
        <OrderRow key={o.id} order={o} requestId={item.id} cancel={item.kind === "cancel"} />
      ))}
    </View>
  );
}

function OrderRow({ order, requestId, cancel }: { order: RequestOrder; requestId: string; cancel: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const cancelIt = useCancelFromRequest();
  const [asking, setAsking] = useState(false);
  return (
    <View style={styles.order}>
      <Text style={styles.title}>
        {t("orders.number", { number: order.number })} · {formatDay(order.pickupDay)} · {formatCzk(order.totalCzk)}
      </Text>
      <Text style={styles.items}>{itemsSummary(order)}</Text>
      {!cancel ? (
        <Button
          label={t("requests.openOrder")}
          variant="secondary"
          onPress={() => router.push(`/objednavka/${order.id}`)}
        />
      ) : asking ? (
        <>
          <Text style={styles.question}>{t("orders.cancelQuestion")}</Text>
          <Text style={styles.muted}>{t("requests.cancelHint")}</Text>
          {cancelIt.error ? <Text style={styles.error}>{cancelIt.error.message}</Text> : null}
          <Button
            label={t("orders.cancelYes")}
            busy={cancelIt.isPending}
            onPress={() => cancelIt.mutate({ id: requestId, orderId: order.id })}
          />
          <Button label={t("orders.cancelNo")} variant="secondary" onPress={() => setAsking(false)} />
        </>
      ) : (
        <Button label={t("orders.cancel")} variant="secondary" onPress={() => setAsking(true)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  heading: { fontSize: font.label, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
  muted: { fontSize: font.label, color: colors.muted },
  order: { gap: space.xs, paddingVertical: space.xs, borderTopWidth: 1, borderTopColor: colors.border },
  title: { fontSize: font.body, fontWeight: "600", color: colors.text },
  items: { fontSize: font.body, color: colors.text },
  question: { fontSize: font.body, fontWeight: "700", color: colors.text },
  error: { fontSize: font.body, color: colors.danger },
});
