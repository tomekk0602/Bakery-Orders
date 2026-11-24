import type { DictationResponse } from "@bakery/core/contracts";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, colors, font, radius, space } from "@/shared/ui";

type Unmatched = DictationResponse["unmatched"][number];
type Props = {
  items: Unmatched[];
  onPick: (word: string, productId: string, quantity: number) => void;
  onDismiss: (word: string) => void;
};

/** Words that matched no product: staff pick the right one or drop the word — never guessed (FR-020). */
export function SuggestionPicker({ items, onPick, onDismiss }: Props) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  return (
    <Card>
      {items.map((u) => (
        <View key={u.word} style={styles.block}>
          <Text style={styles.word}>{t("dictation.unmatched", { word: u.word, count: u.quantity ?? 1 })}</Text>
          <View style={styles.row}>
            {u.candidates.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                onPress={() => onPick(u.word, c.id, u.quantity ?? 1)}
                style={styles.chip}
              >
                <Text style={styles.chipText}>{c.name}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => onDismiss(u.word)}
              style={[styles.chip, styles.dismiss]}
            >
              <Text style={styles.dismissText}>{t("dictation.dismiss")}</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  word: { fontSize: font.body, color: colors.text, fontWeight: "600" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  chipText: { fontSize: font.label, color: colors.primary, fontWeight: "600" },
  dismiss: { borderColor: colors.border },
  dismissText: { fontSize: font.label, color: colors.muted },
});
