import type { OrderCard } from "@bakery/core/contracts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { Button, Card, colors, font, Screen } from "@/shared/ui";
import { useConfirmDraft, useOrderForm, usePrepareOrder } from "./api";
import { emptyOrder, OrderForm, toInput } from "./OrderForm";
import { OrderCardView } from "./OrderCardView";

type Values = Parameters<typeof toInput>[0];
type Step = { kind: "form"; values: Values | null } | { kind: "card"; card: OrderCard; values: Values } | { kind: "saved"; number: number };

/** "Nová objednávka": form → the order card from the server → one tap to save (US6, FR-017, FR-019). */
export function NewOrderScreen() {
  const { t } = useTranslation();
  const form = useOrderForm();
  const prepare = usePrepareOrder();
  const confirm = useConfirmDraft();
  const [step, setStep] = useState<Step>({ kind: "form", values: null });

  if (form.isPending) return <ActivityIndicator style={styles.center} color={colors.primary} accessibilityLabel={t("common.loading")} />;
  if (form.isError)
    return (
      <Screen title={t("tabs.newOrder")}>
        <Text style={styles.error}>{form.error.message}</Text>
        <Button label={t("common.retry")} onPress={() => void form.refetch()} />
      </Screen>
    );

  const restart = () => {
    prepare.reset();
    confirm.reset();
    setStep({ kind: "form", values: null });
  };

  return (
    <Screen title={t("tabs.newOrder")}>
      {step.kind === "form" ? (
        <OrderForm
          form={form.data}
          initial={step.values ?? emptyOrder(form.data)}
          busy={prepare.isPending}
          error={prepare.error?.message ?? null}
          onSubmit={(values) => prepare.mutate(toInput(values), { onSuccess: (card) => setStep({ kind: "card", card, values }) })}
        />
      ) : null}
      {step.kind === "card" ? (
        <OrderCardView
          card={step.card}
          busy={confirm.isPending}
          error={confirm.error?.message ?? null}
          onEdit={() => setStep({ kind: "form", values: step.values })}
          onConfirm={() => confirm.mutate(step.card.draftId, { onSuccess: (saved) => setStep({ kind: "saved", number: saved.orderNumber }) })}
        />
      ) : null}
      {step.kind === "saved" ? (
        <>
          <Card>
            <Text style={styles.saved} accessibilityRole="alert">
              {t("newOrder.saved", { number: step.number })}
            </Text>
          </Card>
          <Button label={t("newOrder.another")} onPress={restart} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  error: { fontSize: font.body, color: colors.danger },
  saved: { fontSize: font.body + 2, fontWeight: "700", color: "#166534" },
});
