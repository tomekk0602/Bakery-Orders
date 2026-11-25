import { type ReactNode, useContext } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaInsetsContext, SafeAreaView } from "react-native-safe-area-context";
import { colors, CONTENT_MAX_WIDTH, font, space, TAB_BAR } from "./tokens";

type Props = { title?: string; children: ReactNode; refreshing?: boolean; onRefresh?: () => void };

/** A scrollable page; pull-to-refresh when `onRefresh` is given. */
export function Screen({ title, children, refreshing = false, onRefresh }: Props) {
  // the tab bar floats over the page, so the last item must scroll above it (FR-074)
  // (the context, not the hook: a page rendered without the app's provider has no inset, not an error)
  const below = TAB_BAR.height + TAB_BAR.inset + (useContext(SafeAreaInsetsContext)?.bottom ?? 0) + space.md;
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: below }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          ) : undefined
        }
      >
        {title ? (
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.md, gap: space.md, width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" },
  title: { fontSize: font.title, fontWeight: "700", color: colors.text },
});
