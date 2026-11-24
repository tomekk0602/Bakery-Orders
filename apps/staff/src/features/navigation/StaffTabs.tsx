import { Tabs, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useMe } from "@/features/auth/use-me";
import { authClient } from "@/shared/auth/client";
import { Button, colors, font, Screen, space } from "@/shared/ui";
import { TABS } from "./tabs";

/** Tabs of the signed-in role. Hiding is convenience; the server checks every request (FR-043, FR-045). */
export function StaffTabs() {
  const { t } = useTranslation();
  const me = useMe();
  const router = useRouter();

  if (me.isPending) return <ActivityIndicator style={styles.center} color={colors.primary} accessibilityLabel={t("common.loading")} />;
  if (me.isError)
    return (
      <Screen>
        <Text style={styles.error}>{me.error.message}</Text>
        <Button label={t("common.retry")} onPress={() => void me.refetch()} />
      </Screen>
    );

  const granted = new Set(me.data.permissions);
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerRight: () => (
          <View style={styles.header}>
            <Text style={styles.role}>{t(`roles.${me.data.user.role}`)}</Text>
            <Pressable accessibilityRole="button" onPress={() => void authClient.signOut()} hitSlop={12}>
              <Text style={styles.signOut}>{t("common.signOut")}</Text>
            </Pressable>
          </View>
        ),
      }}
    >
      {/* Routes that are not tabs: the redirect and the order detail opened from a list. */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="objednavka/[id]"
        options={{
          href: null,
          title: t("orders.detailTitle"),
          headerLeft: () => (
            <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12} style={styles.back}>
              <Text style={styles.signOut}>{t("orders.back")}</Text>
            </Pressable>
          ),
        }}
      />
      {TABS.map((tab) => (
        <Tabs.Protected key={tab.name} guard={granted.has(tab.permission)}>
          <Tabs.Screen name={tab.name} options={{ title: t(tab.titleKey) }} />
        </Tabs.Protected>
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  error: { color: colors.danger, fontSize: font.body },
  header: { flexDirection: "row", gap: space.md, marginRight: space.md, alignItems: "center" },
  role: { color: colors.muted, fontSize: font.label },
  back: { marginLeft: space.md },
  signOut: { color: colors.primary, fontSize: font.label, fontWeight: "600" },
});
