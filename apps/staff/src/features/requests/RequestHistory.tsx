import type { RequestHistoryEntry } from "@bakery/core/contracts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font, space } from "@/shared/ui";
import { TIME } from "./time";

/** What was done on a request, by whom and when, oldest first (spec 001 FR-051); folded by default. */
export function RequestHistory({ history }: { history: RequestHistoryEntry[] }) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  if (history.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Pressable accessibilityRole="button" onPress={() => setShown((v) => !v)} hitSlop={8}>
        <Text style={styles.link}>
          {shown ? t("requests.hideHistory") : t("requests.showHistory", { count: history.length })}
        </Text>
      </Pressable>
      {shown
        ? history.map((h, i) => (
            <View key={i}>
              <Text style={styles.step}>
                {TIME.format(new Date(h.at))} · {h.by ?? "—"} ·{" "}
                {t(`requests.step.${h.kind}`, { number: h.orderNumber ?? "" })}
              </Text>
              {h.note ? <Text style={styles.note}>„{h.note}“</Text> : null}
            </View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  link: { fontSize: font.label, color: colors.primary, fontWeight: "600" },
  step: { fontSize: font.label, color: colors.text },
  note: { fontSize: font.label, color: colors.muted, fontStyle: "italic", marginLeft: space.md },
});
