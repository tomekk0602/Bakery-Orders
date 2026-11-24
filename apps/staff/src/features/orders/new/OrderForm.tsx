import { zodResolver } from "@hookform/resolvers/zod";
import type { DictationResponse, OrderFormResponse, StaffOrderInput } from "@bakery/core/contracts";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text } from "react-native";
import { z } from "zod";
import { DayPicker } from "@/features/plan/DayPicker";
import { Button, Card, colors, font, TextField } from "@/shared/ui";
import { QuantityStepper } from "./QuantityStepper";
import { SuggestionPicker } from "./SuggestionPicker";

// The form's own shape; the server validates the order again with the shared contract.
const FormValues = z
  .object({
    customerName: z.string().trim().min(1, "newOrder.nameRequired"),
    customerPhone: z
      .string()
      .trim()
      .regex(/^(\+?[0-9 ]{9,16})?$/, "newOrder.phoneInvalid"),
    pickupDate: z.string().min(1),
    quantities: z.record(z.string(), z.number().int().min(0)),
  })
  .refine((v) => Object.values(v.quantities).some((q) => q > 0), {
    path: ["quantities"],
    message: "newOrder.itemsRequired",
  });
type FormValues = z.infer<typeof FormValues>;

export const emptyOrder = (form: OrderFormResponse): FormValues => ({
  customerName: "",
  customerPhone: "",
  pickupDate: (form.days.find((d) => d.relative === "tomorrow") ?? form.days[0])?.date ?? "",
  quantities: {},
});

/** Form values from what a dictated sentence gave; empty fields stay empty for staff to fill (FR-021). */
export const fromDictation = (form: OrderFormResponse, d: DictationResponse): FormValues => ({
  ...emptyOrder(form),
  customerName: d.extraction.customerName ?? "",
  ...(d.extraction.pickupDate ? { pickupDate: d.extraction.pickupDate } : {}),
  quantities: Object.fromEntries(d.extraction.items.map((i) => [i.productId, i.quantity])),
});

export const toInput = (v: FormValues): StaffOrderInput => ({
  customerName: v.customerName,
  customerPhone: v.customerPhone.trim() === "" ? null : v.customerPhone,
  pickupDate: v.pickupDate,
  items: Object.entries(v.quantities)
    .filter(([, q]) => q > 0)
    .map(([productId, quantity]) => ({ productId, quantity })),
});

type Props = {
  form: OrderFormResponse;
  initial: FormValues;
  onSubmit: (values: FormValues) => void;
  busy: boolean;
  error: string | null;
  /** from a dictated sentence: words to resolve, and what to complete */
  suggestions?: DictationResponse["unmatched"];
  notice?: string | null;
};

/** Name, optional phone, day and quantities; staff may order after the cut-off (FR-013, FR-017, FR-021). */
export function OrderForm({ form, initial, onSubmit, busy, error, suggestions = [], notice = null }: Props) {
  const { t } = useTranslation();
  const { control, handleSubmit, formState, getValues, setValue } = useForm<FormValues>({
    resolver: zodResolver(FormValues),
    defaultValues: initial,
  });
  // From the form's current values, not the rendered ones, so quick taps add up.
  const add = (id: string, delta: number) => {
    const current = getValues("quantities");
    setValue(
      "quantities",
      { ...current, [id]: Math.max(0, (current[id] ?? 0) + delta) },
      { shouldValidate: formState.isSubmitted },
    );
  };
  const [open, setOpen] = useState(suggestions);
  const resolve = (word: string) => setOpen((list) => list.filter((u) => u.word !== word));
  const err = (key?: string) => (key ? t(key) : undefined);
  // The "at least one product" rule is attached to the quantities record as a whole.
  const quantitiesError: unknown = formState.errors.quantities;
  const itemsError =
    typeof quantitiesError === "object" &&
    quantitiesError !== null &&
    "message" in quantitiesError &&
    typeof quantitiesError.message === "string"
      ? quantitiesError.message
      : undefined;
  return (
    <>
      {notice ? (
        <Text style={styles.notice} accessibilityRole="alert">
          {notice}
        </Text>
      ) : null}
      <SuggestionPicker
        items={open}
        onDismiss={resolve}
        onPick={(word, id, q) => {
          add(id, q);
          resolve(word);
        }}
      />
      <Controller
        control={control}
        name="customerName"
        render={({ field, fieldState }) => (
          <TextField
            label={t("newOrder.name")}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            autoCapitalize="words"
            error={err(fieldState.error?.message)}
          />
        )}
      />
      <Controller
        control={control}
        name="customerPhone"
        render={({ field, fieldState }) => (
          <TextField
            label={t("newOrder.phone")}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            keyboardType="phone-pad"
            autoComplete="tel"
            error={err(fieldState.error?.message)}
          />
        )}
      />
      <Text style={styles.label}>{t("newOrder.day")}</Text>
      <Controller
        control={control}
        name="pickupDate"
        render={({ field }) => <DayPicker days={form.days} selected={field.value} onSelect={field.onChange} />}
      />
      <Card>
        <Controller
          control={control}
          name="quantities"
          render={({ field }) => (
            <>
              {form.products.map((p) => (
                <QuantityStepper
                  key={p.id}
                  label={p.name}
                  value={field.value[p.id] ?? 0}
                  onStep={(d) => add(p.id, d)}
                />
              ))}
            </>
          )}
        />
      </Card>
      {itemsError ? <Text style={styles.error}>{err(itemsError)}</Text> : null}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button label={t("newOrder.review")} onPress={() => void handleSubmit(onSubmit)()} busy={busy} />
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: font.label, color: colors.muted, fontWeight: "600" },
  error: { fontSize: font.body, color: colors.danger },
  notice: { fontSize: font.body, color: "#92400E", fontWeight: "600" },
});
