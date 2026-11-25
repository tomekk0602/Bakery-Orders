import { z } from "zod";
import { NOTIFICATION_KINDS } from "../notifications.ts";

export const NotificationKindSchema = z.enum(NOTIFICATION_KINDS);

/** GET /api/staff/notifications — the caller's notifications, newest first (spec 002 FR-007). */
export const NotificationList = z.object({
  unread: z.number().int().nonnegative(),
  /** whether the caller's quiet hours are on now: the banner then plays no sound (FR-023) */
  quiet: z.boolean(),
  items: z.array(
    z.object({
      id: z.uuid(),
      kind: NotificationKindSchema,
      title: z.string(),
      body: z.string(),
      link: z.string(),
      createdAt: z.string(),
      readAt: z.string().nullable(),
    }),
  ),
});
export type NotificationList = z.infer<typeof NotificationList>;

export const ReadNotificationBody = z.object({ read: z.literal(true) });
export const ReadAllResult = z.object({ read: z.number().int().nonnegative() });

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM");
export const QuietHoursSchema = z.object({ enabled: z.boolean(), from: HHMM, to: HHMM });

/** GET/PUT /api/staff/notification-settings (FR-014, FR-015). */
export const NotificationSettings = z.object({
  kinds: z.array(
    z.object({ kind: NotificationKindSchema, inApp: z.boolean(), push: z.boolean(), allowed: z.boolean() }),
  ),
  quietHours: QuietHoursSchema,
  /** null when the server has no VAPID keys: device notifications are off */
  vapidPublicKey: z.string().nullable(),
  devices: z.array(
    z.object({
      id: z.uuid(),
      userAgent: z.string().nullable(),
      createdAt: z.string(),
      lastSuccessAt: z.string().nullable(),
    }),
  ),
});
export type NotificationSettings = z.infer<typeof NotificationSettings>;

export const UpdateNotificationSettings = z.object({
  kinds: z.array(z.object({ kind: NotificationKindSchema, inApp: z.boolean(), push: z.boolean() })),
  quietHours: QuietHoursSchema,
});
export type UpdateNotificationSettings = z.infer<typeof UpdateNotificationSettings>;

/** POST /api/staff/push-subscriptions — a browser's PushSubscription as JSON (FR-009). */
export const PushSubscriptionBody = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  userAgent: z.string().max(300).optional(),
});
export type PushSubscriptionBody = z.infer<typeof PushSubscriptionBody>;

export const RemovePushSubscriptionBody = z.object({ endpoint: z.url().max(1000) });
export const PushSubscriptionCreated = z.object({ id: z.uuid(), testSent: z.boolean() });

/** GET /api/cron/plan-summary (FR-004, FR-005). */
export const PlanSummaryResult = z.object({ day: z.string(), created: z.number().int(), pushed: z.number().int() });
