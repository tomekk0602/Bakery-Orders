import type { StaffRequestItem } from "@bakery/core/contracts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Badge, Button, Card, colors, font, space, TextField } from "@/shared/ui";
import { useRequestAction } from "./api";
import { RequestHistory } from "./RequestHistory";
import { RequestOrders } from "./RequestOrders";
import { TIME } from "./time";

/** A note when closing a request (FR-051); the server takes at most 300 characters. */
const NOTE_MAX = 300;

/**
 * One request worked through to the end (spec 001 FR-047–FR-052): who it is and what they want, who is
 * calling now, the unanswered calls so far, the customer's orders for a cancel or change, and the steps
 * taken. Closing asks for an optional note.
 */
export function RequestCard({ item }: { item: StaffRequestItem }) {
  const { t } = useTranslation();
  const act = useRequestAction();
  const [showTranscript, setShowTranscript] = useState(false);
  const [closing, setClosing] = useState<"handled" | "unreachable" | null>(null);
  const [note, setNote] = useState("");
  const open = item.doneAt === null;
  const busy = act.isPending;
  const lastAttempt = [...item.history].reverse().find((h) => h.kind === "unanswered");

  const call = () => {
    act.mutate({ id: item.id, action: "call" });
    void Linking.openURL(`tel:${item.customerPhone}`);
  };
  const close = () => {
    if (!closing) return;
    act.mutate({ id: item.id, action: closing, ...(note.trim() ? { note: note.trim() } : {}) });
    setClosing(null);
    setNote("");
  };

  return (
    <Card muted={!open}>
      <View style={styles.row}>
        <Badge label={t(`requests.kind.${item.kind}`)} tone={item.kind === "callback" ? "neutral" : "warning"} />
        {item.origin === "promised_not_recorded" ? <Badge label={t("requests.promised")} tone="warning" /> : null}
        {item.outcome ? (
          <Badge
            label={t(`requests.outcome.${item.outcome}`)}
            tone={item.outcome === "handled" ? "success" : "neutral"}
          />
        ) : null}
        <Text style={styles.time}>{TIME.format(new Date(item.createdAt))}</Text>
      </View>
      <Text style={styles.name}>{item.customerName ?? t("requests.noName")}</Text>
      <Text style={styles.note}>{item.note}</Text>

      {open && item.callingNow ? (
        <Badge label={t("requests.calling", { name: item.callingNow.name })} tone="warning" />
      ) : null}
      {item.attempts > 0 && lastAttempt ? (
        <Text style={styles.attempts}>
          {t("requests.attempts", {
            count: item.attempts,
            time: TIME.format(new Date(lastAttempt.at)),
            name: lastAttempt.by ?? "—",
          })}
        </Text>
      ) : null}

      {open && item.customerPhone ? (
        <Button
          label={t("orders.call", { phone: item.customerPhone })}
          variant="secondary"
          onPress={call}
          disabled={busy}
        />
      ) : null}

      {open && item.kind !== "callback" ? <RequestOrders item={item} /> : null}

      {item.transcript ? (
        <Pressable accessibilityRole="button" onPress={() => setShowTranscript((v) => !v)} hitSlop={8}>
          <Text style={styles.link}>
            {showTranscript ? t("requests.hideTranscript") : t("requests.showTranscript")}
          </Text>
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

      <RequestHistory history={item.history} />
      {act.error ? <Text style={styles.error}>{act.error.message}</Text> : null}

      {!open ? (
        <Button
          label={t("requests.reopen")}
          variant="secondary"
          onPress={() => act.mutate({ id: item.id, action: "reopen" })}
          busy={busy}
        />
      ) : closing ? (
        <View style={styles.closing}>
          <TextField
            label={t("requests.noteLabel")}
            value={note}
            onChangeText={setNote}
            maxLength={NOTE_MAX}
            placeholder={t("requests.notePlaceholder")}
          />
          <Button
            label={closing === "handled" ? t("requests.confirmHandled") : t("requests.confirmUnreachable")}
            onPress={close}
            busy={busy}
          />
          <Button label={t("requests.back")} variant="secondary" onPress={() => setClosing(null)} />
        </View>
      ) : (
        <View style={styles.actions}>
          <Button label={t("requests.done")} onPress={() => setClosing("handled")} busy={busy} />
          {item.customerPhone ? (
            <Button
              label={t("requests.unanswered")}
              variant="secondary"
              onPress={() => act.mutate({ id: item.id, action: "unanswered" })}
              disabled={busy}
            />
          ) : null}
          {item.canCloseUnreachable ? (
            <Button
              label={t("requests.closeUnreachable")}
              variant="secondary"
              onPress={() => setClosing("unreachable")}
              disabled={busy}
            />
          ) : null}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  time: { marginLeft: "auto", fontSize: font.label, color: colors.muted },
  name: { fontSize: font.body + 2, fontWeight: "700", color: colors.text },
  note: { fontSize: font.body, color: colors.text },
  attempts: { fontSize: font.label, color: colors.danger, fontWeight: "600" },
  link: { fontSize: font.label, color: colors.primary, fontWeight: "600" },
  turn: { fontSize: font.label, color: colors.text },
  who: { color: colors.muted, fontWeight: "600" },
  error: { fontSize: font.body, color: colors.danger },
  actions: { gap: space.sm },
  closing: { gap: space.sm },
});
