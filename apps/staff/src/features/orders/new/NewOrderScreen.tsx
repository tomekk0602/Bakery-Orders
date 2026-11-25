import type { DictationResponse, OrderCard } from "@bakery/core/contracts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { isUncertain } from "@/shared/api/uncertain";
import { Button, Card, colors, font, Screen, space } from "@/shared/ui";
import { useConfirmDraft, useDictate, useOrderForm, usePrepareOrder } from "./api";
import { DictationPanel } from "./DictationPanel";
import { emptyOrder, fromDictation, OrderForm, toInput } from "./OrderForm";
import { OrderCardView } from "./OrderCardView";

type Values = Parameters<typeof toInput>[0];
type Step =
  | { kind: "voice" }
  | { kind: "form"; values: Values | null; suggestions?: DictationResponse["unmatched"]; notice?: string | null }
  | { kind: "card"; card: OrderCard; values: Values }
  | { kind: "saved"; number: number };

/** "Nová objednávka": one sentence or the form → the order card from the server → one tap to save (US6). */
export function NewOrderScreen() {
  const { t } = useTranslation();
  const form = useOrderForm();
  const prepare = usePrepareOrder();
  const dictate = useDictate();
  const confirm = useConfirmDraft();
  const [step, setStep] = useState<Step>({ kind: "voice" });
  // an edited card is a new draft, so after an unknown result only the same card may be confirmed (FR-077)
  const uncertain = confirm.isError && isUncertain(confirm.error);

  if (form.isPending)
    return <ActivityIndicator style={styles.center} color={colors.primary} accessibilityLabel={t("common.loading")} />;
  if (form.isError)
    return (
      <Screen title={t("tabs.newOrder")}>
        <Text style={styles.error}>{form.error.message}</Text>
        <Button label={t("common.retry")} onPress={() => void form.refetch()} />
      </Screen>
    );

  const restart = (kind: "voice" | "form") => {
    prepare.reset();
    dictate.reset();
    confirm.reset();
    setStep(kind === "voice" ? { kind } : { kind, values: null });
  };

  /** A complete sentence goes straight to the card; anything to resolve goes to the prefilled form. */
  const onDictated = (d: DictationResponse) => {
    const values = fromDictation(form.data, d);
    if (d.card) return setStep({ kind: "card", card: d.card, values });
    const missing = d.missing.map((m) => t(`dictation.missing.${m}`)).join(", ");
    const notice = d.refusal?.message ?? (missing ? t("dictation.complete", { fields: missing }) : null);
    setStep({ kind: "form", values, suggestions: d.unmatched, notice });
  };

  return (
    <Screen title={t("tabs.newOrder")}>
      {step.kind === "voice" || step.kind === "form" ? (
        <View style={styles.modes}>
          <Button
            label={t("dictation.byVoice")}
            variant={step.kind === "voice" ? "primary" : "secondary"}
            onPress={() => restart("voice")}
          />
          <Button
            label={t("dictation.byForm")}
            variant={step.kind === "form" ? "primary" : "secondary"}
            onPress={() => restart("form")}
          />
        </View>
      ) : null}
      {step.kind === "voice" ? (
        <DictationPanel
          busy={dictate.isPending}
          error={dictate.error?.message ?? null}
          onSubmit={(text) => dictate.mutate(text, { onSuccess: onDictated })}
        />
      ) : null}
      {step.kind === "form" ? (
        <OrderForm
          form={form.data}
          initial={step.values ?? emptyOrder(form.data)}
          suggestions={step.suggestions}
          notice={step.notice}
          busy={prepare.isPending}
          error={prepare.error?.message ?? null}
          onSubmit={(values) =>
            prepare.mutate(toInput(values), { onSuccess: (card) => setStep({ kind: "card", card, values }) })
          }
        />
      ) : null}
      {step.kind === "card" ? (
        <OrderCardView
          card={step.card}
          busy={confirm.isPending}
          error={uncertain ? t("newOrder.uncertain") : (confirm.error?.message ?? null)}
          uncertain={uncertain}
          onEdit={() => setStep({ kind: "form", values: step.values })}
          onConfirm={() =>
            confirm.mutate(step.card.draftId, {
              onSuccess: (saved) => setStep({ kind: "saved", number: saved.orderNumber }),
            })
          }
        />
      ) : null}
      {step.kind === "saved" ? (
        <>
          <Card>
            <Text style={styles.saved} accessibilityRole="alert">
              {t("newOrder.saved", { number: step.number })}
            </Text>
          </Card>
          <Button label={t("newOrder.another")} onPress={() => restart("voice")} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  modes: { gap: space.sm },
  error: { fontSize: font.body, color: colors.danger },
  saved: { fontSize: font.body + 2, fontWeight: "700", color: "#166534" },
});
