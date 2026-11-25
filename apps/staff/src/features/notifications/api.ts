import {
  NotificationList,
  NotificationSettings,
  PushSubscriptionCreated,
  ReadAllResult,
  type UpdateNotificationSettings,
} from "@bakery/core/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "@/shared/api/http";

export const notificationKeys = {
  list: ["notifications"] as const,
  settings: ["notification-settings"] as const,
};

/**
 * How often the bell and the banners re-read while the app is open (FR-007 as amended 2026-11-25,
 * research N14): 10 s, proposed and not measured. TanStack Query pauses it in the background.
 */
export const NOTIFICATIONS_REFRESH_MS = 10_000;

export const useNotifications = (enabled = true) =>
  useQuery({
    queryKey: notificationKeys.list,
    queryFn: () => api("/api/staff/notifications", NotificationList),
    enabled,
    refetchInterval: NOTIFICATIONS_REFRESH_MS,
  });

const Ok = z.object({ ok: z.literal(true) });

export function useReadNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/staff/notifications/${id}`, Ok, { method: "PATCH", body: JSON.stringify({ read: true }) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.list }),
  });
}

export function useReadAll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api("/api/staff/notifications/read-all", ReadAllResult, { method: "POST" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.list }),
  });
}

export const useNotificationSettings = () =>
  useQuery({
    queryKey: notificationKeys.settings,
    queryFn: () => api("/api/staff/notification-settings", NotificationSettings),
  });

export function useSaveNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: UpdateNotificationSettings) =>
      api("/api/staff/notification-settings", NotificationSettings, { method: "PUT", body: JSON.stringify(v) }),
    onSuccess: (data) => queryClient.setQueryData(notificationKeys.settings, data),
  });
}

/** Registers this browser's push subscription; the server answers after sending a test notification. */
export const registerDevice = (subscription: unknown) =>
  api("/api/staff/push-subscriptions", PushSubscriptionCreated, {
    method: "POST",
    body: JSON.stringify(subscription),
  });

/** 204 without a body: the client reads it as null. */
export const unregisterDevice = (endpoint: string) =>
  api("/api/staff/push-subscriptions", z.null(), { method: "DELETE", body: JSON.stringify({ endpoint }) });
