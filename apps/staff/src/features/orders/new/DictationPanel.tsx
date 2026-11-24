import { useTranslation } from "react-i18next";
import { StyleSheet, Text } from "react-native";
import { useDictation } from "@/shared/speech/useDictation";
import { Button, colors, font, TextField } from "@/shared/ui";

type Props = { onSubmit: (text: string) => void; busy: boolean; error: string | null };

/** One spoken sentence → editable text → processed on the server (FR-017, FR-018, FR-022). */
export function DictationPanel({ onSubmit, busy, error }: Props) {
  const { t } = useTranslation();
  const d = useDictation();
  return (
    <>
      <Text style={styles.hint}>{t("dictation.example")}</Text>
      {d.supported ? (
        <Button label={d.listening ? t("dictation.stop") : t("dictation.start")} variant={d.listening ? "secondary" : "primary"} onPress={d.listening ? d.stop : d.start} />
      ) : (
        <Text style={styles.hint}>{t("dictation.keyboardHint")}</Text>
      )}
      {d.error ? <Text style={styles.error}>{t("dictation.micError")}</Text> : null}
      <TextField label={t("dictation.text")} value={d.text} onChangeText={d.setText} multiline autoCapitalize="sentences" />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button label={t("dictation.process")} onPress={() => onSubmit(d.text)} busy={busy} disabled={d.text.trim() === "" || d.listening} />
    </>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: font.label, color: colors.muted },
  error: { fontSize: font.body, color: colors.danger },
});
