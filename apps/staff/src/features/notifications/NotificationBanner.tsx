import { useQueryClient } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOrder } from "@/features/orders/api";
import { formatCzk, formatDay, itemsSummary } from "@/features/orders/format";
import { colors, font, radius, space } from "@/shared/ui";
import { notificationKeys, useNotifications, useReadNotification } from "./api";
import { BANNER_MS, type BannerItem, MAX_VISIBLE_BANNERS, orderIdOf, pickBanners } from "./banners";
import { onPushMessage } from "./device";
import { isSoundOn, playChime, unlockSoundOnFirstTouch } from "./sound";

/** Off-screen start and end of the slide (above the top edge). */
const HIDDEN_Y = -200;
const SLIDE_MS = 300;
const nativeDriver = Platform.OS !== "web";

/**
 * Banners for notifications that arrive while the app is open: they slide in from the top, stay
 * 30 seconds and slide away; a tap opens what they are about (spec 002 FR-021–FR-024; research N13).
 */
export function NotificationBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const list = useNotifications();
  const since = useRef<string | null>(null);
  const shown = useRef(new Set<string>());
  const [banners, setBanners] = useState<BannerItem[]>([]);

  useEffect(unlockSoundOnFirstTouch, []);
  // a push to this visible window: read the list now rather than at the next poll (FR-026)
  useEffect(
    () => onPushMessage(() => void queryClient.invalidateQueries({ queryKey: notificationKeys.list })),
    [queryClient],
  );

  useEffect(() => {
    if (!list.data) return;
    const { fresh, since: next } = pickBanners(list.data.items, since.current, shown.current);
    since.current = next;
    if (fresh.length === 0) return;
    for (const n of fresh) shown.current.add(n.id);
    setBanners((b) => [...fresh, ...b]);
    if (!list.data.quiet && isSoundOn()) playChime();
  }, [list.data]);

  const close = (id: string) => setBanners((b) => b.filter((n) => n.id !== id));
  if (banners.length === 0) return null;
  const waiting = banners.length - MAX_VISIBLE_BANNERS;

  return (
    <View style={[styles.stack, { top: insets.top + space.sm }]} pointerEvents="box-none">
      {banners.slice(0, MAX_VISIBLE_BANNERS).map((n) => (
        <Banner key={n.id} item={n} onClose={() => close(n.id)} />
      ))}
      {waiting > 0 ? <Text style={styles.more}>{t("notifications.banner.more", { count: waiting })}</Text> : null}
    </View>
  );
}

function Banner({ item, onClose }: { item: BannerItem; onClose: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const read = useReadNotification();
  const [y] = useState(() => new Animated.Value(HIDDEN_Y));
  const closing = useRef(false);

  const hide = (then?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(y, { toValue: HIDDEN_Y, duration: SLIDE_MS, useNativeDriver: nativeDriver }).start(() => {
      onClose();
      then?.();
    });
  };

  useEffect(() => {
    Animated.timing(y, { toValue: 0, duration: SLIDE_MS, useNativeDriver: nativeDriver }).start();
    const timer = setTimeout(() => hide(), BANNER_MS);
    return () => clearTimeout(timer);
    // the banner's own lifetime: started once when it appears
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = () => {
    read.mutate(item.id);
    router.push(item.link as Href);
    hide();
  };

  const orderId = orderIdOf(item);
  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: y }] }]}>
      <Pressable
        style={styles.content}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.body}`}
        accessibilityHint={t("notifications.banner.open")}
        onPress={open}
      >
        {orderId ? <OrderDetails orderId={orderId} fallback={item} /> : <Plain item={item} />}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("notifications.banner.close")}
        onPress={() => hide()}
        hitSlop={12}
        style={styles.close}
      >
        <Text style={styles.closeText}>×</Text>
      </Pressable>
    </Animated.View>
  );
}

function Plain({ item }: { item: BannerItem }) {
  return (
    <>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.body}>{item.body}</Text>
    </>
  );
}

/** A new order with what the counter needs to know at a glance (FR-022); the text until it loads. */
function OrderDetails({ orderId, fallback }: { orderId: string; fallback: BannerItem }) {
  const { t } = useTranslation();
  const order = useOrder(orderId);
  if (!order.data) return <Plain item={fallback} />;
  const o = order.data;
  return (
    <>
      <View style={styles.row}>
        <Text style={styles.title}>{t("notifications.banner.order", { number: o.number })}</Text>
        <Text style={styles.total}>{formatCzk(o.totalCzk)}</Text>
      </View>
      <Text style={styles.name}>{o.customerName}</Text>
      <Text style={styles.body}>
        {formatDay(o.pickupDay)} · {t(`orders.source.${o.source}`)}
      </Text>
      <Text style={styles.items}>{itemsSummary(o)}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: "absolute",
    left: space.sm,
    right: space.sm,
    alignItems: "center",
    gap: space.sm,
    zIndex: 1000,
  },
  banner: {
    width: "100%",
    maxWidth: 520,
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderLeftWidth: 6,
    borderLeftColor: colors.primary,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  content: { flex: 1, padding: space.md, gap: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  title: { fontSize: font.body, fontWeight: "700", color: colors.text },
  total: { fontSize: font.body, fontWeight: "700", color: colors.primary, fontVariant: ["tabular-nums"] },
  name: { fontSize: font.body, fontWeight: "600", color: colors.text },
  body: { fontSize: font.label, color: colors.muted },
  items: { fontSize: font.body, color: colors.text },
  close: { paddingHorizontal: space.md, paddingTop: space.sm },
  closeText: { fontSize: 26, color: colors.muted },
  more: {
    fontSize: font.label,
    color: colors.primaryText,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    overflow: "hidden",
  },
});
