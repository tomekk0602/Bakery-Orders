import { notificationText, subjectOf } from "@bakery/core";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { user } from "./auth-schema.ts";
import { createStaffRequest } from "./calls.repo.ts";
import { createDb, type Db } from "./client.ts";
import {
  deleteOldNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationSettings,
  notifyStaff,
  saveNotificationSettings,
} from "./notifications.repo.ts";
import { pendingPushes, pushFailures, recordPush, savePushSubscription } from "./push.repo.ts";
import { actOnRequest } from "./requests.repo.ts";
import { notification, pushSubscription } from "./schema.ts";

let container: StartedPostgreSqlContainer;
let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:17").start();
  const created = createDb(container.getConnectionUri());
  db = created.db;
  close = () => created.pool.end();
  await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
}, 120_000);

afterAll(async () => {
  await close?.();
  await container?.stop();
});

const OWNER = { id: "owner-1", role: "owner" as const };
const EMPLOYEE = { id: "employee-1", role: "employee" as const };

beforeEach(async () => {
  await db.delete(notification);
  await db.delete(user);
  await db.insert(user).values([
    { id: OWNER.id, name: "Majitel", email: "o@test.local", role: "owner" },
    { id: EMPLOYEE.id, name: "Prodavač", email: "e@test.local", role: "employee" },
    { id: "banned-1", name: "Bývalý", email: "b@test.local", role: "employee", banned: true },
  ]);
});

const callback = () =>
  createStaffRequest(db, {
    kind: "callback",
    origin: "agent",
    customerName: "Nováková",
    customerPhone: "+420777123456",
    note: "Zavolat",
  });

describe("a request notifies everyone who can handle it (spec 002 FR-001–FR-003)", () => {
  it("creates one notification per active staff member, together with the request, without personal data", async () => {
    const r = await callback();
    expect(r.notificationIds).toHaveLength(2); // owner and employee, not the banned account
    const rows = await db.select().from(notification);
    expect(rows.map((n) => n.recipientId).sort()).toEqual([EMPLOYEE.id, OWNER.id]);
    for (const n of rows) {
      expect(n.subject).toBe(subjectOf.request(r.id));
      expect(`${n.title} ${n.body}`).not.toContain("Nováková");
      expect(`${n.title} ${n.body}`).not.toContain("777");
    }
  });

  it("never twice for the same subject and person", async () => {
    const r = await callback();
    const again = await notifyStaff(db, {
      kind: "request",
      subject: subjectOf.request(r.id),
      text: notificationText.request("callback"),
    });
    expect(again).toEqual([]);
    expect(await db.select().from(notification)).toHaveLength(2);
  });

  it("handling the request reads it for everyone; reopening does not bring it back", async () => {
    const r = await callback();
    expect((await listNotifications(db, EMPLOYEE.id)).unread).toBe(1);
    await actOnRequest(db, { id: r.id, userId: EMPLOYEE.id, action: "handled" });
    expect((await listNotifications(db, EMPLOYEE.id)).unread).toBe(0);
    expect((await listNotifications(db, OWNER.id)).unread).toBe(0);
    await actOnRequest(db, { id: r.id, userId: OWNER.id, action: "reopen" });
    expect((await listNotifications(db, OWNER.id)).unread).toBe(0);
  });

  it("someone who switched requests off gets none", async () => {
    await saveNotificationSettings(db, EMPLOYEE, {
      kinds: [{ kind: "request", inApp: false, push: false }],
      quietHours: { enabled: true, from: "20:00", to: "04:00" },
    });
    await callback();
    expect((await listNotifications(db, EMPLOYEE.id)).items).toHaveLength(0);
    expect((await listNotifications(db, OWNER.id)).items).toHaveLength(1);
  });
});

describe("reading (FR-007, FR-008)", () => {
  it("one's own only; mark all", async () => {
    await callback();
    await callback();
    const mine = await listNotifications(db, EMPLOYEE.id);
    expect(mine.unread).toBe(2);
    const ownersId = (await listNotifications(db, OWNER.id)).items[0]!.id;
    expect(await markNotificationRead(db, EMPLOYEE.id, ownersId)).toBe(false);
    expect(await markNotificationRead(db, EMPLOYEE.id, mine.items[0]!.id)).toBe(true);
    expect((await listNotifications(db, EMPLOYEE.id)).unread).toBe(1);
    expect(await markAllNotificationsRead(db, EMPLOYEE.id)).toBe(1);
    expect((await listNotifications(db, OWNER.id)).unread).toBe(2);
  });
});

describe("settings (FR-014, FR-015)", () => {
  it("the summary is the owner's by default; employees may switch it on but not the owner's warnings", async () => {
    const ids = await notifyStaff(db, {
      kind: "plan_summary",
      subject: subjectOf.planSummary("2026-11-25"),
      text: notificationText.planSummary({ day: "2026-11-25", weekdayName: "středa", orders: 3, top: [] }),
    });
    expect(ids).toHaveLength(1);
    const settings = await notificationSettings(db, EMPLOYEE, null);
    expect(settings.kinds.find((k) => k.kind === "plan_summary")).toMatchObject({ inApp: false, allowed: true });
    expect(settings.kinds.find((k) => k.kind === "near_limit")).toMatchObject({ allowed: false });
    expect(settings.quietHours).toEqual({ enabled: true, from: "20:00", to: "04:00" });
    const refused = await saveNotificationSettings(db, EMPLOYEE, {
      kinds: [{ kind: "near_limit", inApp: true, push: true }],
      quietHours: settings.quietHours,
    });
    expect(refused).toEqual({ ok: false, reason: "not_allowed", kind: "near_limit" });
  });
});

describe("devices (FR-009, FR-011)", () => {
  const device = { endpoint: "https://push.example/abc", keys: { p256dh: "p", auth: "a" } };

  it("pending pushes skip what is already read; a gone device is removed; a failure is counted", async () => {
    const deviceId = await savePushSubscription(db, EMPLOYEE.id, device);
    expect(await savePushSubscription(db, EMPLOYEE.id, device)).toBe(deviceId); // same endpoint, same device
    const r = await callback();
    const pending = await pendingPushes(db, r.notificationIds);
    const employees = pending.find((p) => p.devices.length > 0)!;
    expect(employees.devices[0]!.endpoint).toBe(device.endpoint);

    await recordPush(db, { notificationId: employees.id, deviceId, result: "failed", error: "503" });
    expect(await pushFailures(db, new Date(Date.now() - 60_000), new Date(Date.now() + 60_000))).toBe(1);
    await recordPush(db, { notificationId: employees.id, deviceId, result: "gone" });
    expect(await db.select().from(pushSubscription).where(eq(pushSubscription.id, deviceId))).toEqual([]);

    await actOnRequest(db, { id: r.id, userId: EMPLOYEE.id, action: "handled" });
    expect(await pendingPushes(db, r.notificationIds)).toEqual([]);
  });

  it("notifications older than 30 days are deleted", async () => {
    await callback();
    expect(await deleteOldNotifications(db, new Date(Date.now() + 1000))).toBe(2);
  });
});
