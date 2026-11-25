import Ionicons from "@expo/vector-icons/Ionicons";
import { BlurView } from "expo-blur";
import { Tabs, useRouter } from "expo-router";
import { PlatformPressable } from "expo-router/react-navigation";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMe } from "@/features/auth/use-me";
import { disableDevice } from "@/features/notifications/device";
import { NotificationBanner } from "@/features/notifications/NotificationBanner";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { useRequests } from "@/features/requests/api";
import { authClient } from "@/shared/auth/client";
import { Button, colors, font, ICON_SIZE, Screen, space, TAB_BAR } from "@/shared/ui";
import { TABS, tabIcon } from "./tabs";

/**
 * A route reachable by navigation but without a tab button. Not `href: null`: since Expo Router 58 that
 * marks the screen hidden, and navigating to a hidden screen redirects to the first tab — the order
 * detail and "Upozornění" bounced to "Dnes".
 */
const NOT_A_TAB = { tabBarButton: () => null, tabBarItemStyle: { display: "none" } } as const;

/** The bar's surface: blur behind a translucent white, inside the pill (FR-074). */
function TabBarBackground() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.barSurface]}>
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.glass]} />
    </View>
  );
}

/** Tabs of the signed-in role. Hiding is convenience; the server checks every request (FR-043, FR-045). */
export function StaffTabs() {
  const { t } = useTranslation();
  const me = useMe();
  // The badge on "Požadavky": open requests, re-read while the app is open (FR-041).
  const requests = useRequests(me.data?.permissions.includes("request:view") ?? false);
  const openRequests = requests.data?.open.length ?? 0;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // a floating pill: inset from the edges, at most TAB_BAR.maxWidth and centred (FR-074)
  const window = useWindowDimensions();
  const barWidth = Math.min(window.width - 2 * TAB_BAR.inset, TAB_BAR.maxWidth);
  // Back to the screen this came from; opened straight from a link or a device notification there is
  // none, so "Dnes" (the first tab every role has).
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/dnes"));
  // Signing out also stops this device's notifications for the account (spec 002 FR-012).
  const signOut = async () => {
    await disableDevice().catch(() => undefined);
    await authClient.signOut();
  };

  if (me.isPending)
    return <ActivityIndicator style={styles.center} color={colors.primary} accessibilityLabel={t("common.loading")} />;
  if (me.isError)
    return (
      <Screen>
        <Text style={styles.error}>{me.error.message}</Text>
        <Button label={t("common.retry")} onPress={() => void me.refetch()} />
      </Screen>
    );

  const granted = new Set(me.data.permissions);
  return (
    <View style={styles.center}>
      <Tabs
        // tabs remember where the person came from, so "Zpět" from a detail returns there
        backBehavior="history"
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarActiveBackgroundColor: colors.tabActive,
          tabBarLabelPosition: "below-icon",
          tabBarLabelStyle: styles.tabLabel,
          tabBarItemStyle: styles.tabItem,
          tabBarStyle: [
            styles.tabBar,
            { width: barWidth, left: (window.width - barWidth) / 2, bottom: insets.bottom + TAB_BAR.inset },
          ],
          tabBarBackground: () => <TabBarBackground />,
          // the default button with a pill's corners: the selected background and the focus ring follow them
          tabBarButton: (props) => <PlatformPressable {...props} style={[props.style, styles.tabButton]} />,
          headerRight: () => (
            <View style={styles.header}>
              <NotificationBell />
              <Text style={styles.role}>{t(`roles.${me.data.user.role}`)}</Text>
              <Pressable accessibilityRole="button" onPress={() => void signOut()} hitSlop={12}>
                <Text style={styles.signOut}>{t("common.signOut")}</Text>
              </Pressable>
            </View>
          ),
        }}
      >
        {/* the redirect at "/" (hidden) */}
        <Tabs.Screen name="index" options={{ href: null }} />
        {TABS.map((tab) => (
          <Tabs.Protected key={tab.name} guard={granted.has(tab.permission)}>
            <Tabs.Screen
              name={tab.name}
              options={{
                title: t(tab.titleKey),
                tabBarLabel: t(tab.labelKey),
                tabBarIcon: ({ focused }) => (
                  <Ionicons
                    name={tabIcon(tab.icon, focused)}
                    size={ICON_SIZE}
                    color={focused ? colors.primary : colors.muted}
                    testID={`tab-icon-${tab.name}-${focused ? "filled" : "outline"}`}
                  />
                ),
                tabBarBadge: tab.name === "pozadavky" && openRequests > 0 ? openRequests : undefined,
              }}
            />
          </Tabs.Protected>
        ))}
        {/* Routes without a tab button, after the tabs: a tab navigator starts on its first screen that is not
            hidden, and that must be "dnes" (spec 001 FR-045, research R38). */}
        <Tabs.Screen
          name="objednavka/[id]"
          options={{
            ...NOT_A_TAB,
            title: t("orders.detailTitle"),
            headerLeft: () => (
              <Pressable accessibilityRole="button" onPress={goBack} hitSlop={12} style={styles.back}>
                <Text style={styles.signOut}>{t("orders.back")}</Text>
              </Pressable>
            ),
          }}
        />
        <Tabs.Screen
          name="upozorneni"
          options={{
            ...NOT_A_TAB,
            title: t("notifications.title"),
            headerLeft: () => (
              <Pressable accessibilityRole="button" onPress={goBack} hitSlop={12} style={styles.back}>
                <Text style={styles.signOut}>{t("orders.back")}</Text>
              </Pressable>
            ),
          }}
        />
        {/* the owner's archive of closed requests (spec 001 FR-054) */}
        <Tabs.Protected guard={granted.has("request:archive")}>
          <Tabs.Screen
            name="archiv"
            options={{
              ...NOT_A_TAB,
              title: t("requests.archive.title"),
              headerLeft: () => (
                <Pressable accessibilityRole="button" onPress={goBack} hitSlop={12} style={styles.back}>
                  <Text style={styles.signOut}>{t("orders.back")}</Text>
                </Pressable>
              ),
            }}
          />
        </Tabs.Protected>
      </Tabs>
      <NotificationBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  error: { color: colors.danger, fontSize: font.body },
  header: { flexDirection: "row", gap: space.md, marginRight: space.md, alignItems: "center" },
  role: { color: colors.muted, fontSize: font.label },
  back: { marginLeft: space.md },
  signOut: { color: colors.primary, fontSize: font.label, fontWeight: "600" },
  tabBar: {
    position: "absolute",
    height: TAB_BAR.height,
    paddingBottom: 0,
    paddingHorizontal: space.xs,
    borderRadius: TAB_BAR.height / 2,
    borderTopWidth: 0,
    backgroundColor: "transparent",
    boxShadow: "0 6px 24px rgba(28, 25, 23, 0.14)",
  },
  barSurface: { borderRadius: TAB_BAR.height / 2, overflow: "hidden" },
  glass: { backgroundColor: Platform.OS === "android" ? colors.glassOpaque : colors.glass },
  tabItem: { marginVertical: space.xs + 2, marginHorizontal: 2 },
  tabButton: { borderRadius: TAB_BAR.height / 2 },
  tabLabel: { fontSize: 11, fontWeight: "600" },
});
