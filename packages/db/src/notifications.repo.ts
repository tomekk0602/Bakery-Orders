import {
  DEFAULT_QUIET_HOURS,
  defaultPreference,
  isQuiet,
  isRole,
  kindAllowed,
  NOTIFICATION_KINDS,
  type NotificationKind,
  type NotificationText,
  type Preference,
  type QuietHours,
  type Role,
} from "@bakery/core";
import type { NotificationList, NotificationSettings, UpdateNotificationSettings } from "@bakery/core/contracts";
import { and, count, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { user } from "./auth-schema.ts";
import type { Db } from "./client.ts";
import { notification, notificationPreference, notificationQuietHours, pushSubscription } from "./schema.ts";

/** A transaction or the database: notifications are written inside the event's transaction (FR-001). */
type Tx = Pick<Db, "select" | "insert" | "update" | "delete">;

const hhmm = (t: string) => t.slice(0, 5);

/** Each staff member's effective preference for a kind: their choice, else the role's default (FR-014). */
async function preferencesFor(tx: Tx, kind: NotificationKind, users: { id: string; role: Role }[]) {
  if (users.length === 0) return new Map<string, Preference>();
  const chosen = await tx
    .select()
    .from(notificationPreference)
    .where(
      and(
        eq(notificationPreference.kind, kind),
        inArray(
          notificationPreference.userId,
          users.map((u) => u.id),
        ),
      ),
    );
  const byUser = new Map(chosen.map((c) => [c.userId, { inApp: c.inApp, push: c.push }]));
  return new Map(users.map((u) => [u.id, byUser.get(u.id) ?? defaultPreference(kind, u.role)]));
}

/** Staff accounts allowed to act on a kind (FR-006); a banned account gets nothing. */
async function staffFor(tx: Tx, kind: NotificationKind, only?: { except?: string }) {
  const rows = await tx.select({ id: user.id, role: user.role, banned: user.banned }).from(user);
  return rows
    .filter((r) => !r.banned && r.id !== only?.except && isRole(r.role) && kindAllowed(kind, r.role))
    .map((r) => ({ id: r.id, role: r.role as Role }));
}

/**
 * Creates one notification per allowed staff member for a subject, inside the caller's transaction
 * (FR-001), at most once per subject and person (FR-002, FR-005). People who switched the kind off in
 * the app and on devices get nothing. Returns the ids created now, for delivery after the response.
 */
export async function notifyStaff(
  tx: Tx,
  v: { kind: NotificationKind; subject: string; text: NotificationText; except?: string; onlyRole?: Role },
): Promise<string[]> {
  const staff = (await staffFor(tx, v.kind, { except: v.except })).filter((s) => !v.onlyRole || s.role === v.onlyRole);
  const prefs = await preferencesFor(tx, v.kind, staff);
  const rows = staff
    .map((s) => ({ s, p: prefs.get(s.id) ?? defaultPreference(v.kind, s.role) }))
    .filter(({ p }) => p.inApp || p.push)
    .map(({ s, p }) => ({
      recipientId: s.id,
      kind: v.kind,
      subject: v.subject,
      ...v.text,
      inApp: p.inApp,
      push: p.push,
    }));
  if (rows.length === 0) return [];
  const created = await tx.insert(notification).values(rows).onConflictDoNothing().returning({ id: notification.id });
  return created.map((c) => c.id);
}

/** Handling the subject reads its notifications for everyone (FR-003). */
export async function readBySubject(tx: Tx, subject: string, now = new Date()): Promise<void> {
  await tx
    .update(notification)
    .set({ readAt: now })
    .where(and(eq(notification.subject, subject), isNull(notification.readAt)));
}

/** The caller's in-app notifications, newest first, and how many are unread (FR-007). */
export async function listNotifications(
  db: Db,
  userId: string,
  limit = 50,
  now = new Date(),
): Promise<NotificationList> {
  const mine = and(eq(notification.recipientId, userId), eq(notification.inApp, true));
  const items = await db.select().from(notification).where(mine).orderBy(desc(notification.createdAt)).limit(limit);
  const [unread] = await db
    .select({ n: count() })
    .from(notification)
    .where(and(mine, isNull(notification.readAt)));
  return {
    unread: unread?.n ?? 0,
    quiet: isQuiet(now, await quietHoursOf(db, userId)),
    items: items.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      link: n.link,
      createdAt: n.createdAt.toISOString(),
      readAt: n.readAt?.toISOString() ?? null,
    })),
  };
}

/** Marks one of the caller's notifications read; false when it is not theirs (FR-008). */
export async function markNotificationRead(db: Db, userId: string, id: string, now = new Date()): Promise<boolean> {
  const updated = await db
    .update(notification)
    .set({ readAt: sql`coalesce(${notification.readAt}, ${now.toISOString()}::timestamptz)` })
    .where(and(eq(notification.id, id), eq(notification.recipientId, userId)))
    .returning({ id: notification.id });
  return updated.length > 0;
}

export async function markAllNotificationsRead(db: Db, userId: string, now = new Date()): Promise<number> {
  const updated = await db
    .update(notification)
    .set({ readAt: now })
    .where(and(eq(notification.recipientId, userId), isNull(notification.readAt)))
    .returning({ id: notification.id });
  return updated.length;
}

export async function quietHoursOf(db: Tx, userId: string): Promise<QuietHours> {
  const [q] = await db.select().from(notificationQuietHours).where(eq(notificationQuietHours.userId, userId));
  return q ? { enabled: q.enabled, from: hhmm(q.quietFrom), to: hhmm(q.quietTo) } : DEFAULT_QUIET_HOURS;
}

/** The caller's settings: every kind with its effective preference and whether the role allows it (FR-014). */
export async function notificationSettings(
  db: Db,
  me: { id: string; role: Role },
  vapidPublicKey: string | null,
): Promise<NotificationSettings> {
  const chosen = await db.select().from(notificationPreference).where(eq(notificationPreference.userId, me.id));
  const kinds = NOTIFICATION_KINDS.map((kind) => {
    const c = chosen.find((x) => x.kind === kind);
    const p = c ? { inApp: c.inApp, push: c.push } : defaultPreference(kind, me.role);
    return { kind, ...p, allowed: kindAllowed(kind, me.role) };
  });
  const devices = await db
    .select({
      id: pushSubscription.id,
      userAgent: pushSubscription.userAgent,
      createdAt: pushSubscription.createdAt,
      lastSuccessAt: pushSubscription.lastSuccessAt,
    })
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, me.id))
    .orderBy(desc(pushSubscription.createdAt));
  return {
    kinds,
    quietHours: await quietHoursOf(db, me.id),
    vapidPublicKey,
    devices: devices.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
      lastSuccessAt: d.lastSuccessAt?.toISOString() ?? null,
    })),
  };
}

export type SaveNotificationSettingsResult =
  { ok: true } | { ok: false; reason: "not_allowed"; kind: NotificationKind };

/** Saves the caller's choices; a kind the role cannot act on is refused (FR-006, FR-014, FR-015). */
export async function saveNotificationSettings(
  db: Db,
  me: { id: string; role: Role },
  v: UpdateNotificationSettings,
): Promise<SaveNotificationSettingsResult> {
  const refused = v.kinds.find((k) => !kindAllowed(k.kind, me.role) && (k.inApp || k.push));
  if (refused) return { ok: false, reason: "not_allowed", kind: refused.kind };
  await db.transaction(async (tx) => {
    for (const k of v.kinds.filter((k) => kindAllowed(k.kind, me.role)))
      await tx
        .insert(notificationPreference)
        .values({ userId: me.id, kind: k.kind, inApp: k.inApp, push: k.push })
        .onConflictDoUpdate({
          target: [notificationPreference.userId, notificationPreference.kind],
          set: { inApp: k.inApp, push: k.push },
        });
    const q = { enabled: v.quietHours.enabled, quietFrom: v.quietHours.from, quietTo: v.quietHours.to };
    await tx
      .insert(notificationQuietHours)
      .values({ userId: me.id, ...q })
      .onConflictDoUpdate({ target: notificationQuietHours.userId, set: q });
  });
  return { ok: true };
}

/** Notifications are kept 30 days (FR-016); called by the nightly retention job. */
export async function deleteOldNotifications(db: Tx, before: Date): Promise<number> {
  const gone = await db
    .delete(notification)
    .where(lt(notification.createdAt, before))
    .returning({ id: notification.id });
  return gone.length;
}

/** Whether a subject already has notifications — the daily summary goes out once per day (FR-005). */
export async function subjectNotified(db: Tx, subject: string): Promise<boolean> {
  const [r] = await db.select({ n: count() }).from(notification).where(eq(notification.subject, subject));
  return (r?.n ?? 0) > 0;
}
