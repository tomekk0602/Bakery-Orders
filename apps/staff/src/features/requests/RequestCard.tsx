import type { StaffRequestItem } from "@bakery/core/contracts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Badge, Button, Card, colors, font, space } from "@/shared/ui";

const TIME = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Europe/Prague" });

type Props = { item: StaffRequestItem; onToggle: () => void; busy: boolean };

/** One request: what it is, who, what the agent understood, call back, mark handled (FR-008, FR-034). */
export function RequestCard({ item, onToggle, busy }: Props) {
  const { t } = useTranslation();
  const [showTranscript, setShowTranscript] = useState(false);
  const done = item.doneAt !== null;
  return (
    <Card muted={done}>
      <View style={styles.row}>
        <Badge label={t(`requests.kind.${item.kind}`)} tone={item.kind === "callback" ? "neutral" : "warning"} />
        {item.origin === "promised_not_recorded" ? <Badge label={t("requests.promised")} tone="warning" /> : null}
        <Text style={styles.time}>{TIME.format(new Date(item.createdAt))}</Text>
      </View>
      <Text style={styles.name}>{item.customerName ?? t("requests.noName")}</Text>
      <Text style={styles.note}>{item.note}</Text>
      {item.customerPhone ? <Button label={t("orders.call", { phone: item.customerPhone })} variant="secondary" onPress={() => void Linking.openURL(`tel:${item.customerPhone}`)} /> : null}
      {item.transcript ? (
        <Pressable accessibilityRole="button" onPress={() => setShowTranscript((v) => !v)} hitSlop={8}>
          <Text style={styles.link}>{showTranscript ? t("requests.hideTranscript") : t("requests.showTranscript")}</Text>
        </Pressable>
      ) : null}
      {showTranscript && item.transcript
        ? item.transcript.map((turn, i) => (
            <Text key={i} style={styles.turn}>
              <Text style={styles.who}>{t(turn.role === "agent" ? "orders.agentSaid" : "orders.customerSaid")}: </Text>
              {turn.text}
            </Text>
          ))
        : null}
      <Button label={done ? t("requests.reopen") : t("requests.done")} variant={done ? "secondary" : "primary"} onPress={onToggle} busy={busy} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  time: { marginLeft: "auto", fontSize: font.label, color: colors.muted },
  name: { fontSize: font.body + 2, fontWeight: "700", color: colors.text },
  note: { fontSize: font.body, color: colors.text },
  link: { fontSize: font.label, color: colors.primary, fontWeight: "600" },
  turn: { fontSize: font.label, color: colors.text },
  who: { color: colors.muted, fontWeight: "600" },
});
