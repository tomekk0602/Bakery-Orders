import type { NotificationList } from "@bakery/core/contracts";
import { type Href, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, colors, font, Screen, space } from "@/shared/ui";
import { useNotifications, useReadAll, useReadNotification } from "./api";
import { NotificationSettingsSection } from "./NotificationSettingsSection";

const TIME = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});

type Item = NotificationList["items"][number];

/**
 * "Upozornění": the person's notifications, newest first; opening one reads it and goes where it
 * points; "Označit vše" reads all (FR-007, FR-008). The person's own settings follow (FR-012–FR-015).
 */
export function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const list = useNotifications();
  const read = useReadNotification();
  const readAll = useReadAll();

  if (list.isPending)
    return <ActivityIndicator style={styles.center} color={colors.primary} accessibilityLabel={t("common.loading")} />;
  if (list.isError)
    return (
      <Screen title={t("notifications.title")}>
        <Text style={styles.error}>{list.error.message}</Text>
        <Button label={t("common.retry")} onPress={() => void list.refetch()} />
      </Screen>
    );

  const open = (n: Item) => {
    if (!n.readAt) read.mutate(n.id);
    router.push(n.link as Href);
  };

  return (
    <Screen title={t("notifications.title")} refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      {list.data.unread > 0 ? (
        <Button
          label={t("notifications.readAll")}
          variant="secondary"
          busy={readAll.isPending}
          onPress={() => readAll.mutate()}
        />
      ) : null}
      {list.data.items.length === 0 ? <Text style={styles.muted}>{t("notifications.none")}</Text> : null}
      {list.data.items.map((n) => (
        <Pressable
          key={n.id}
          accessibilityRole="button"
          accessibilityLabel={`${n.readAt ? "" : `${t("notifications.unread")}: `}${n.title}. ${n.body}`}
          onPress={() => open(n)}
        >
          <Card>
            <View style={styles.row}>
              {n.readAt ? null : <View style={styles.dot} />}
              <Text style={[styles.title, !n.readAt && styles.bold]}>{n.title}</Text>
              <Text style={styles.time}>{TIME.format(new Date(n.createdAt))}</Text>
            </View>
            <Text style={styles.body}>{n.body}</Text>
          </Card>
        </Pressable>
      ))}
      <NotificationSettingsSection />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  error: { fontSize: font.body, color: colors.danger },
  muted: { fontSize: font.body, color: colors.muted },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  title: { flex: 1, fontSize: font.body, color: colors.text },
  bold: { fontWeight: "700" },
  time: { fontSize: font.label, color: colors.muted },
  body: { fontSize: font.body, color: colors.text },
});
