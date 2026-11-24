import { PROVOZ_PERIODS, type ProvozResponse } from "@bakery/core/contracts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { formatDay } from "@/features/orders/format";
import { Button, Card, colors, font, Screen, space } from "@/shared/ui";
import { useProvoz } from "./api";

const seconds = (ms: number | null) =>
  ms === null ? "—" : `${(ms / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} s`;
const usd = (x: number | null) =>
  x === null ? "—" : x.toLocaleString("cs-CZ", { style: "currency", currency: "USD", maximumFractionDigits: 4 });

/** "Provoz": how the phone agent is doing — outcomes, response time, channels, cost (FR-033, ADR-0013). Owner only. */
export function ProvozScreen() {
  const { t } = useTranslation();
  const [days, setDays] = useState<number>(PROVOZ_PERIODS[0]);
  const q = useProvoz(days);

  if (q.isPending)
    return <ActivityIndicator style={styles.center} color={colors.primary} accessibilityLabel={t("common.loading")} />;
  if (q.isError)
    return (
      <Screen title={t("ops.title")}>
        <Text style={styles.error}>{q.error.message}</Text>
        <Button label={t("common.retry")} onPress={() => void q.refetch()} />
      </Screen>
    );

  const p = q.data;
  return (
    <Screen title={t("ops.title")} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <View style={styles.periods}>
        {PROVOZ_PERIODS.map((d) => (
          <View key={d} style={styles.period}>
            <Button
              label={t("ops.period", { days: d })}
              variant={d === days ? "primary" : "secondary"}
              onPress={() => setDays(d)}
            />
          </View>
        ))}
      </View>
      <Text style={styles.note}>
        {t("ops.periodRange", { from: formatDay(p.period.from), to: formatDay(p.period.to) })}
      </Text>
      <Calls p={p} />
      <Card>
        <Text style={styles.heading}>{t("ops.latency")}</Text>
        {p.firstAudio.samples === 0 ? (
          <Text style={styles.note}>{t("ops.noSamples")}</Text>
        ) : (
          <>
            <Row label={t("ops.p50")} value={seconds(p.firstAudio.p50Ms)} />
            <Row label={t("ops.p95")} value={seconds(p.firstAudio.p95Ms)} />
            <Row label={t("ops.samples")} value={String(p.firstAudio.samples)} />
          </>
        )}
        <Text style={styles.note}>{t("ops.latencyHint")}</Text>
      </Card>
      <Card>
        <Text style={styles.heading}>{t("ops.orders")}</Text>
        {(["phone", "web", "staff"] as const).map((s) => (
          <Row key={s} label={t(`ops.source.${s}`)} value={String(p.orders[s])} />
        ))}
        <Row
          label={t("ops.corrected")}
          value={p.phoneCorrectedShare === null ? t("ops.notMeasured") : `${Math.round(p.phoneCorrectedShare * 100)} %`}
        />
      </Card>
      <Card>
        <Text style={styles.heading}>{t("ops.cost")}</Text>
        <Row label={t("ops.costTotal")} value={usd(p.cost.shadowUsd)} />
        <Row label={t("ops.perCall")} value={usd(p.cost.perCallUsd)} />
        <Row label={t("ops.perOrder")} value={usd(p.cost.perPhoneOrderUsd)} />
        <Text style={styles.note}>{t("ops.costHint", { date: formatDay(p.cost.pricesReadOn) })}</Text>
      </Card>
      {p.promptVersions.length > 0 ? (
        <Card>
          <Text style={styles.heading}>{t("ops.versions")}</Text>
          {p.promptVersions.map((v) => (
            <Row key={v.version} label={v.version} value={t("ops.versionCalls", { count: v.calls })} />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

function Calls({ p }: { p: ProvozResponse }) {
  const { t } = useTranslation();
  return (
    <Card>
      <Text style={styles.heading}>{t("ops.calls")}</Text>
      <Row label={t("ops.callsTotal")} value={String(p.calls.total)} bold />
      {(["order", "request", "abandoned", "capped", "error", "open"] as const).map((o) => (
        <Row key={o} label={t(`ops.outcome.${o}`)} value={String(p.calls[o])} />
      ))}
    </Card>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.label, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.value, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  error: { fontSize: font.body, color: colors.danger },
  note: { fontSize: font.label, color: colors.muted },
  heading: { fontSize: font.body + 2, fontWeight: "700", color: colors.text, marginBottom: space.xs },
  periods: { flexDirection: "row", gap: space.sm },
  period: { flex: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: space.sm, paddingVertical: space.xs },
  label: { flex: 1, fontSize: font.body, color: colors.text },
  value: { fontSize: font.body, color: colors.text, fontVariant: ["tabular-nums"] },
  bold: { fontWeight: "700" },
});
