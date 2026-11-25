import type { BakingPlanResponse } from "@bakery/core/contracts";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Button, Card, colors, font, Screen, space } from "@/shared/ui";
import { formatDay } from "@/features/orders/format";
import { usePlan } from "./api";
import { DayPicker } from "./DayPicker";

/** "Plán": how many of each product to bake for a day. Read-only; buffers are the owner's settings (FR-010, FR-044). */
export function PlanScreen() {
  const { t } = useTranslation();
  // the day lives in the address, so a plan notification opens the day it names (spec 002 FR-028)
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string }>();
  const day = typeof params.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : null;
  const plan = usePlan(day);

  if (plan.isPending)
    return <ActivityIndicator style={styles.center} color={colors.primary} accessibilityLabel={t("common.loading")} />;
  if (plan.isError)
    return (
      <Screen title={t("tabs.plan")}>
        <Text style={styles.error}>{plan.error.message}</Text>
        <Button label={t("common.retry")} onPress={() => void plan.refetch()} />
      </Screen>
    );

  const p = plan.data;
  return (
    <Screen
      title={t("plan.title", { day: formatDay(p.day.date) })}
      refreshing={plan.isRefetching}
      onRefresh={() => void plan.refetch()}
    >
      <DayPicker days={p.days} selected={p.day.date} onSelect={(d) => router.setParams({ day: d })} />
      {p.day.closed ? <Text style={styles.note}>{t("plan.closedNote")}</Text> : null}
      <PlanTable plan={p} />
      <Text style={styles.note}>{t("plan.explain")}</Text>
    </Screen>
  );
}

function PlanTable({ plan }: { plan: BakingPlanResponse }) {
  const { t } = useTranslation();
  return (
    <Card>
      <Row cells={[t("plan.product"), t("plan.reserved"), t("plan.buffer"), t("plan.toBake")]} header />
      {plan.lines.map((l) => (
        <Row key={l.productId} cells={[l.name, String(l.reserved), String(l.buffer), String(l.toBake)]} />
      ))}
      <Row
        cells={[t("plan.total"), String(plan.totals.reserved), String(plan.totals.buffer), String(plan.totals.toBake)]}
        header
      />
    </Card>
  );
}

function Row({ cells, header = false }: { cells: [string, string, string, string]; header?: boolean }) {
  const [name, ...numbers] = cells;
  return (
    <View style={[styles.row, header && styles.headerRow]} accessible accessibilityLabel={cells.join(", ")}>
      <Text style={[styles.name, header && styles.bold]}>{name}</Text>
      {numbers.map((n, i) => (
        <Text key={i} style={[styles.num, (header || i === 2) && styles.bold]}>
          {n}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  error: { fontSize: font.body, color: colors.danger },
  note: { fontSize: font.label, color: colors.muted },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.xs },
  headerRow: { borderBottomWidth: 1, borderColor: colors.border },
  name: { flex: 1, fontSize: font.body, color: colors.text },
  num: { width: 64, textAlign: "right", fontSize: font.body, color: colors.text, fontVariant: ["tabular-nums"] },
  bold: { fontWeight: "700" },
});
