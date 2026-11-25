import { pragueDate } from "@bakery/core";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { user } from "./auth-schema.ts";
import { createStaffRequest } from "./calls.repo.ts";
import { createDb, type Db } from "./client.ts";
import { listNotifications } from "./notifications.repo.ts";
import { actOnRequest, archivePage, cancelOrderFromRequest, listStaffRequests } from "./requests.repo.ts";
import { applyRetention } from "./retention.repo.ts";
import { dailyCapacity, notification, order, orderLine, staffRequest, staffRequestEvent } from "./schema.ts";
import { seedBakery } from "./seed.ts";

let container: StartedPostgreSqlContainer;
let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:17").start();
  const created = createDb(container.getConnectionUri());
  db = created.db;
  close = () => created.pool.end();
  await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
  await seedBakery(db);
  await db.insert(user).values([
    { id: "jana", name: "Jana", email: "jana@test.local", role: "employee" },
    { id: "petr", name: "Petr", email: "petr@test.local", role: "owner" },
  ]);
}, 120_000);

afterAll(async () => {
  await close?.();
  await container?.stop();
});

beforeEach(async () => {
  await db.delete(notification);
  await db.delete(staffRequest);
});

const NOW = new Date();
const tomorrow = pragueDate(new Date(NOW.getTime() + 24 * 60 * 60 * 1000));

const request = (kind: "callback" | "cancel" | "change", customerPhone: string | null = "+420777123456") =>
  createStaffRequest(db, { kind, origin: "agent", customerName: "Nováková", customerPhone, note: "Zavolat" });

const openOne = async (id: string) => (await listStaffRequests(db)).open.find((r) => r.id === id);

describe("working a request through (spec 001 FR-047–FR-051)", () => {
  it("a started call shows who is calling; an unanswered one counts and keeps it open", async () => {
    const { id } = await request("callback");
    expect(await actOnRequest(db, { id, userId: "jana", action: "call" })).toEqual({ ok: true });
    expect((await openOne(id))?.callingNow).toEqual({ name: "Jana" });

    await actOnRequest(db, { id, userId: "jana", action: "unanswered" });
    const after = await openOne(id);
    expect(after).toMatchObject({ attempts: 1, callingNow: null, canCloseUnreachable: false, doneAt: null });
    expect(after?.history.map((h) => [h.kind, h.by])).toEqual([
      ["call_started", "Jana"],
      ["unanswered", "Jana"],
    ]);
  });

  it("the mark of a started call expires after five minutes", async () => {
    const { id } = await request("callback");
    await actOnRequest(db, { id, userId: "jana", action: "call", now: new Date(NOW.getTime() - 6 * 60 * 1000) });
    expect((await openOne(id))?.callingNow).toBeNull();
  });

  it("unreachable only from the third unanswered call; it closes as unreachable, not handled", async () => {
    const { id } = await request("callback");
    for (let i = 0; i < 2; i++) await actOnRequest(db, { id, userId: "jana", action: "unanswered" });
    expect(await actOnRequest(db, { id, userId: "jana", action: "unreachable" })).toEqual({
      ok: false,
      reason: "too_early",
    });
    await actOnRequest(db, { id, userId: "petr", action: "unanswered" });
    expect((await openOne(id))?.canCloseUnreachable).toBe(true);
    await actOnRequest(db, { id, userId: "petr", action: "unreachable", note: "3× nebere" });
    const closed = (await listStaffRequests(db)).closedToday.find((r) => r.id === id);
    expect(closed).toMatchObject({ outcome: "unreachable", attempts: 3 });
    expect(closed?.history.at(-1)).toMatchObject({ kind: "unreachable", by: "Petr", note: "3× nebere" });
  });

  it("handled with a note reads the request's notifications; reopening keeps the history", async () => {
    const { id } = await request("callback");
    expect((await listNotifications(db, "jana")).unread).toBe(1);
    await actOnRequest(db, { id, userId: "jana", action: "handled", note: "přesunuto na sobotu" });
    expect((await listNotifications(db, "jana")).unread).toBe(0);
    expect(await actOnRequest(db, { id, userId: "jana", action: "handled" })).toEqual({
      ok: false,
      reason: "closed",
    });
    await actOnRequest(db, { id, userId: "petr", action: "reopen" });
    const reopened = await openOne(id);
    expect(reopened).toMatchObject({ outcome: null, doneAt: null });
    expect(reopened?.history.map((h) => h.kind)).toEqual(["handled", "reopened"]);
    expect(reopened?.history[0]?.note).toBe("přesunuto na sobotu");
  });

  it("without a phone number there is nothing to call", async () => {
    const { id } = await request("callback", null);
    expect(await actOnRequest(db, { id, userId: "jana", action: "call" })).toEqual({ ok: false, reason: "no_phone" });
    expect(await actOnRequest(db, { id, userId: "jana", action: "handled" })).toEqual({ ok: true });
  });
});

describe("cancelling from a request (FR-052, SC-014)", () => {
  async function phoneOrder(phone: string, quantity = 2) {
    const [o] = await db
      .insert(order)
      .values({ source: "phone", customerName: "Nováková", customerPhone: phone, pickupDay: tomorrow, totalCzk: 138 })
      .returning();
    await db.insert(orderLine).values({ orderId: o!.id, productId: "chleb-kminovy", quantity, unitPriceCzk: 69 });
    await db
      .insert(dailyCapacity)
      .values({ productId: "chleb-kminovy", day: tomorrow, reserved: quantity })
      .onConflictDoUpdate({ target: [dailyCapacity.productId, dailyCapacity.day], set: { reserved: quantity } });
    return o!;
  }

  it("lists the number's upcoming orders however the number is written, and cancels one with the request", async () => {
    const o = await phoneOrder("777 123 456");
    const { id } = await request("cancel", "+420777123456");
    const item = await openOne(id);
    expect(item?.orders.map((x) => x.number)).toEqual([o.number]);

    expect(await cancelOrderFromRequest(db, { requestId: id, orderId: o.id, userId: "jana" })).toEqual({
      ok: true,
      orderNumber: o.number,
    });
    const [saved] = await db.select().from(order).where(eq(order.id, o.id));
    expect(saved?.status).toBe("cancelled");
    const [cap] = await db
      .select()
      .from(dailyCapacity)
      .where(and(eq(dailyCapacity.productId, "chleb-kminovy"), eq(dailyCapacity.day, tomorrow)));
    expect(cap?.reserved).toBe(0);
    const closed = (await listStaffRequests(db)).closedToday.find((r) => r.id === id);
    expect(closed).toMatchObject({ outcome: "handled" });
    expect(closed?.history.at(-1)).toMatchObject({ kind: "order_cancelled", by: "Jana", orderNumber: o.number });
  });

  it("an order of another number, or a callback request, cannot be cancelled this way", async () => {
    const other = await phoneOrder("+420 602 000 000");
    const { id } = await request("cancel", "+420777123456");
    expect(await cancelOrderFromRequest(db, { requestId: id, orderId: other.id, userId: "jana" })).toEqual({
      ok: false,
      reason: "not_found",
    });
    const callback = await request("callback", "+420602000000");
    expect(await cancelOrderFromRequest(db, { requestId: callback.id, orderId: other.id, userId: "jana" })).toEqual({
      ok: false,
      reason: "not_cancel",
    });
    const [still] = await db.select().from(order).where(eq(order.id, other.id));
    expect(still?.status).toBe("confirmed");
    expect((await openOne(id))?.doneAt).toBeNull();
  });
});

describe("the work list and the owner's archive (FR-053–FR-056, SC-015)", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

  async function closed(name: string, phone: string, when: Date, outcome: "handled" | "unreachable" = "handled") {
    const { id } = await createStaffRequest(db, {
      kind: "callback",
      origin: "agent",
      customerName: name,
      customerPhone: phone,
      note: "Zavolat",
    });
    if (outcome === "unreachable")
      for (let i = 0; i < 3; i++) await actOnRequest(db, { id, userId: "jana", action: "unanswered", now: when });
    await actOnRequest(db, { id, userId: "jana", action: outcome, now: when });
    return id;
  }

  it("the list holds the open requests and today's closed ones, nothing older", async () => {
    const open = await request("callback");
    const today = await closed("Dnešní", "+420600000001", NOW);
    await closed("Včerejší", "+420600000002", daysAgo(1));
    const list = await listStaffRequests(db);
    expect(list.open.map((r) => r.id)).toEqual([open.id]);
    expect(list.closedToday.map((r) => r.id)).toEqual([today]);
  });

  it("the archive pages newest closed first without repeats, filters by outcome and searches", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 22; i++)
      ids.push(await closed(`Zákazník ${i}`, `+42060000${String(i).padStart(4, "0")}`, daysAgo(2 + i)));
    const lost = await closed("Nebere Novák", "+420 777 999 888", daysAgo(30), "unreachable");

    const first = await archivePage(db, {});
    expect(first.items).toHaveLength(20);
    expect(first.items[0]?.customerName).toBe("Zákazník 0");
    const second = await archivePage(db, { cursor: first.nextCursor ?? undefined });
    expect(second.items.map((r) => r.customerName)).toEqual(["Zákazník 20", "Zákazník 21", "Nebere Novák"]);
    expect(second.nextCursor).toBeNull();

    expect((await archivePage(db, { outcome: "unreachable" })).items.map((r) => r.id)).toEqual([lost]);
    expect((await archivePage(db, { q: "novák" })).items.map((r) => r.id)).toEqual([lost]);
    expect((await archivePage(db, { q: "999 888" })).items.map((r) => r.id)).toEqual([lost]);
    expect((await archivePage(db, { q: "Dnešní" })).items).toEqual([]);
  });

  it("reopening from the archive brings the request back with its history", async () => {
    const id = await closed("Dvořák", "+420600000003", daysAgo(3));
    await actOnRequest(db, { id, userId: "petr", action: "reopen" });
    const back = (await listStaffRequests(db)).open.find((r) => r.id === id);
    expect(back?.history.map((h) => h.kind)).toEqual(["handled", "reopened"]);
    expect((await archivePage(db, {})).items.some((r) => r.id === id)).toBe(false);
  });
});

describe("retention of closed requests (FR-057, SC-016)", () => {
  it("deletes closed requests 30 days after closing with their steps; open ones stay", async () => {
    const DAY = 24 * 60 * 60 * 1000;
    const open = await request("callback");
    await actOnRequest(db, { id: open.id, userId: "jana", action: "call", now: new Date(NOW.getTime() - 40 * DAY) });
    const old = await request("callback");
    await actOnRequest(db, { id: old.id, userId: "jana", action: "handled", now: new Date(NOW.getTime() - 31 * DAY) });
    const recent = await request("callback");
    await actOnRequest(db, {
      id: recent.id,
      userId: "jana",
      action: "handled",
      now: new Date(NOW.getTime() - 29 * DAY),
    });

    const r = await applyRetention(db, {
      pickupDayBefore: "1970-01-01",
      callStartedBefore: new Date(0),
      draftExpiredBefore: new Date(0),
      rateWindowBefore: new Date(0),
      notificationCreatedBefore: new Date(0),
      requestClosedBefore: new Date(NOW.getTime() - 30 * DAY),
    });
    expect(r.requests).toBe(1);
    const left = await db.select({ id: staffRequest.id }).from(staffRequest);
    expect(left.map((x) => x.id).sort()).toEqual([open.id, recent.id].sort());
    const steps = await db.select().from(staffRequestEvent).where(eq(staffRequestEvent.requestId, old.id));
    expect(steps).toEqual([]);
  });
});
