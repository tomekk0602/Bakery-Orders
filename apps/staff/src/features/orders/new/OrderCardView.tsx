import type { OrderCard } from "@bakery/core/contracts";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { Button, Card, colors, font, space } from "@/shared/ui";
import { formatCzk, formatDay } from "../format";

type Props = {
  card: OrderCard;
  onConfirm: () => void;
  onEdit: () => void;
  busy: boolean;
  error: string | null;
  /** The last confirmation may have saved the order: only confirming again is safe (FR-077). */
  uncertain?: boolean;
};

/** The order as the server priced it. Nothing is saved until "Potvrdit" (FR-019). */
export function OrderCardView({ card, onConfirm, onEdit, busy, error, uncertain = false }: Props) {
  const { t } = useTranslation();
  return (
    <>
      <Card>
        <Text style={styles.name}>{card.customerName}</Text>
        <Text style={styles.text}>{t("orders.pickup", { day: formatDay(card.pickupDate) })}</Text>
        <Text style={styles.muted}>{card.customerPhone ?? t("orders.noPhone")}</Text>
      </Card>
      <Card>
        {card.lines.map((l) => (
          <View key={l.productId} style={styles.line}>
            <Text style={styles.text}>
              {l.quantity}× {l.name}
            </Text>
            <Text style={styles.text}>{formatCzk(l.subtotalCzk)}</Text>
          </View>
        ))}
        <Text style={styles.total}>{t("orders.total", { total: formatCzk(card.totalCzk) })}</Text>
      </Card>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button label={t("newOrder.confirm")} onPress={onConfirm} busy={busy} />
      <Button label={t("newOrder.edit")} variant="secondary" onPress={onEdit} disabled={busy || uncertain} />
    </>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: font.body + 2, fontWeight: "700", color: colors.text },
  text: { fontSize: font.body, color: colors.text },
  muted: { fontSize: font.body, color: colors.muted },
  error: { fontSize: font.body, color: colors.danger },
  line: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  total: { fontSize: font.body, fontWeight: "700", color: colors.text, textAlign: "right" },
});
