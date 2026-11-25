import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, ICON_SIZE, space } from "@/shared/ui";
import { useNotifications } from "./api";

/** The bell in the header with the unread count; opens "Upozornění" (spec 002 FR-007). */
export function NotificationBell() {
  const { t } = useTranslation();
  const router = useRouter();
  const unread = useNotifications().data?.unread ?? 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("notifications.bell", { count: unread })}
      onPress={() => router.push("/upozorneni")}
      hitSlop={12}
      style={styles.bell}
    >
      <Ionicons name="notifications-outline" size={ICON_SIZE} color={colors.text} />
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: { flexDirection: "row", alignItems: "center", gap: space.xs },
  badge: { backgroundColor: colors.danger, borderRadius: 10, minWidth: 20, paddingHorizontal: 5, alignItems: "center" },
  badgeText: { color: colors.primaryText, fontSize: 12, fontWeight: "700" },
});
