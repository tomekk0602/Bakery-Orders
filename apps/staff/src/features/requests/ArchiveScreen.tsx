import type { RequestOutcome } from "@bakery/core/contracts";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Button, colors, font, Screen, space, TextField } from "@/shared/ui";
import { useRequestArchive } from "./api";
import { RequestCard } from "./RequestCard";

/** Typing pauses this long before the archive is searched, so each key is not a request. */
const SEARCH_DELAY_MS = 300;
const FILTERS = [undefined, "handled", "unreachable"] as const;

/**
 * "Archiv": requests closed before today, owner only — newest closed first, filter by outcome, search
 * by name or number, history and reopen on each card (spec 001 FR-054–FR-056; research R34).
 */
export function ArchiveScreen() {
  const { t } = useTranslation();
  const [outcome, setOutcome] = useState<RequestOutcome | undefined>(undefined);
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQ(typed.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [typed]);
  const archive = useRequestArchive({ outcome, q });
  const items = archive.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen
      title={t("requests.archive.title")}
      refreshing={archive.isRefetching}
      onRefresh={() => void archive.refetch()}
    >
      <Text style={styles.muted}>{t("requests.archive.hint")}</Text>
      <TextField
        label={t("requests.archive.search")}
        value={typed}
        onChangeText={setTyped}
        placeholder={t("requests.archive.searchPlaceholder")}
      />
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <View key={f ?? "all"} style={styles.filter}>
            <Button
              label={t(`requests.archive.filter.${f ?? "all"}`)}
              variant={f === outcome ? "primary" : "secondary"}
              onPress={() => setOutcome(f)}
            />
          </View>
        ))}
      </View>
      {archive.isPending ? (
        <ActivityIndicator color={colors.primary} accessibilityLabel={t("common.loading")} />
      ) : archive.isError ? (
        <>
          <Text style={styles.error}>{archive.error.message}</Text>
          <Button label={t("common.retry")} onPress={() => void archive.refetch()} />
        </>
      ) : items.length === 0 ? (
        <Text style={styles.muted}>{t("requests.archive.empty")}</Text>
      ) : (
        items.map((r) => <RequestCard key={r.id} item={r} />)
      )}
      {archive.hasNextPage ? (
        <Button
          label={t("requests.archive.more")}
          variant="secondary"
          busy={archive.isFetchingNextPage}
          onPress={() => void archive.fetchNextPage()}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: font.body, color: colors.muted },
  error: { fontSize: font.body, color: colors.danger },
  filters: { flexDirection: "row", gap: space.sm },
  filter: { flex: 1 },
});
