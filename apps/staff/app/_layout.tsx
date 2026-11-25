import "@/shared/i18n";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { linkManifest } from "@/features/notifications/device";
import { createQueryClient } from "@/shared/api/query-client";
import { useSession } from "@/shared/auth/client";
import { useCachePerUser } from "@/shared/auth/use-cache-per-user";
import { colors } from "@/shared/ui";

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  useEffect(linkManifest, []);
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionGate />
        <StatusBar style="dark" />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/** One guard for the whole app: signed in → the tabs, signed out → the login (ADR-0015). */
function SessionGate() {
  const { data: session, isPending } = useSession();
  useCachePerUser(useQueryClient(), session?.user.id ?? null);
  if (isPending) return <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
