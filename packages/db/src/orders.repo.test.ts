import { prepareOrder, type PreparedOrder } from "@bakery/core";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "./client.ts";
import { loadBakery, remainingCapacity } from "./bakery.repo.ts";
import { createCall, hitRateLimit } from "./calls.repo.ts";
import { user } from "./auth-schema.ts";
import { confirmDraft, saveDraft, type DraftOwner } from "./orders.repo.ts";
import { closedDay, dailyCapacity, order, product } from "./schema.ts";
import { seedBakery, truncateBakery } from "./seed.ts";

let container: StartedPostgreSqlContainer;
let db: Db;
let close: () => Promise<void>;
const now = new Date("2026-11-24T09:00:00Z"); // Tuesday 10:00 Prague

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

beforeEach(async () => {
  await truncateBakery(db);
  await seedBakery(db);
  await db
    .insert(user)
    .values([
      { id: "staff-1", name: "A", email: "a@test.local" },
      { id: "staff-2", name: "B", email: "b@test.local" },
    ])
    .onConflictDoNothing();
});

const STAFF: DraftOwner = { userId: "staff-1" };

async function prepared(
  items: { productId: string; quantity: number }[],
  owner: DraftOwner = STAFF,
  at: Date = now,
): Promise<{ draftId: string; p: PreparedOrder }> {
  const bakery = await loadBakery(db);
  const remaining = await remainingCapacity(db, bakery.catalogue, "2026-11-28");
  const p = prepareOrder(
    { items, pickupDate: "2026-11-28", customerName: "Nováková", customerPhone: "+420777000111" },
    {
      now: at,
      channel: "phone",
      catalogue: bakery.catalogue,
      schedule: bakery.schedule,
      staffOverride: false,
      remaining,
    },
  );
  if (!p.ok) throw new Error(`prepare refused: ${p.reason}`);
  return { draftId: await saveDraft(db, p, "phone", owner, at), p };
}

const meta = { promptVersion: "test", model: "test" };

describe("confirmDraft", () => {
  it("saves the order, its lines and the capacity in one go", async () => {
    const { draftId } = await prepared([
      { productId: "chleb-kminovy", quantity: 2 },
      { productId: "rohlik", quantity: 6 },
    ]);
    const r = await confirmDraft(db, draftId, STAFF, meta, now);
    expect(r).toEqual(expect.objectContaining({ ok: true, orderNumber: 1001 }));
    const [saved] = await db.select().from(order);
    expect(saved?.totalCzk).toBe(162);
    const [cap] = await db.select().from(dailyCapacity).where(eq(dailyCapacity.productId, "chleb-kminovy"));
    expect(cap?.reserved).toBe(2);
  });

  it("a retried confirmation returns the same order, never a second one (FR-065)", async () => {
    const { draftId } = await prepared([{ productId: "rohlik", quantity: 1 }]);
    const first = await confirmDraft(db, draftId, STAFF, meta, now);
    const again = await confirmDraft(db, draftId, STAFF, meta, now);
    expect(first.ok && again.ok).toBe(true);
    if (!first.ok || !again.ok) return;
    expect(again.orderNumber).toBe(first.orderNumber);
    expect(again.notificationIds).toEqual([]); // the staff were told when it was first saved
    expect(await db.select().from(order)).toHaveLength(1);
    // the answer stays the same after the draft's 24 hours, as long as the draft is kept
    const later = await confirmDraft(db, draftId, STAFF, meta, new Date(now.getTime() + 25 * 60 * 60 * 1000));
    expect(later).toMatchObject({ ok: true, orderNumber: first.orderNumber });
  });

  it("two simultaneous confirmations of one draft save one order and both get its number", async () => {
    const { draftId } = await prepared([{ productId: "rohlik", quantity: 1 }]);
    const [a, b] = await Promise.all([
      confirmDraft(db, draftId, STAFF, meta, now),
      confirmDraft(db, draftId, STAFF, meta, now),
    ]);
    expect(a.ok && b.ok && a.orderNumber === b.orderNumber).toBe(true);
    expect(await db.select().from(order)).toHaveLength(1);
  });

  it("a web draft is confirmed only with its token (FR-064)", async () => {
    const bakery = await loadBakery(db);
    const p = prepareOrder(
      {
        items: [{ productId: "rohlik", quantity: 2 }],
        pickupDate: "2026-11-28",
        customerName: "Web",
        customerPhone: "+420777000222",
      },
      {
        now,
        channel: "web",
        catalogue: bakery.catalogue,
        schedule: bakery.schedule,
        staffOverride: false,
        remaining: {},
      },
    );
    if (!p.ok) throw new Error(p.reason);
    const draftId = await saveDraft(db, p, "web", { webTokenHash: "hash-a" }, now);
    expect(await confirmDraft(db, draftId, { webTokenHash: "hash-b" }, meta, now)).toEqual({
      ok: false,
      reason: "no_draft",
    });
    expect(await confirmDraft(db, draftId, STAFF, meta, now)).toEqual({ ok: false, reason: "no_draft" });
    const saved = await confirmDraft(db, draftId, { webTokenHash: "hash-a" }, meta, now);
    expect(saved).toMatchObject({ ok: true });
    const [row] = await db.select().from(order);
    expect(row).toMatchObject({ source: "web", createdBy: null, callId: null });
  });

  it("an expired draft that was never confirmed is gone", async () => {
    const { draftId } = await prepared([{ productId: "rohlik", quantity: 1 }]);
    const later = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    expect(await confirmDraft(db, draftId, STAFF, meta, later)).toEqual({ ok: false, reason: "no_draft" });
  });

  it("refuses a draft from another call", async () => {
    const callId = await createCall(db, {
      callerPhone: "+420777000111",
      ipHash: "x",
      promptVersion: "test",
      model: "test",
    });
    const otherCall = await createCall(db, {
      callerPhone: "+420777000222",
      ipHash: "y",
      promptVersion: "test",
      model: "test",
    });
    const { draftId } = await prepared([{ productId: "rohlik", quantity: 1 }], { callId });
    expect(await confirmDraft(db, draftId, { callId: otherCall }, meta, now)).toEqual({
      ok: false,
      reason: "no_draft",
    });
    expect(await confirmDraft(db, draftId, STAFF, meta, now)).toEqual({ ok: false, reason: "no_draft" });
  });

  it("refuses a staff draft confirmed by another staff member (FR-019)", async () => {
    const { draftId } = await prepared([{ productId: "rohlik", quantity: 1 }]);
    expect(await confirmDraft(db, draftId, { userId: "staff-2" }, meta, now)).toEqual({
      ok: false,
      reason: "no_draft",
    });
    expect(await confirmDraft(db, draftId, STAFF, meta, now)).toEqual(expect.objectContaining({ ok: true }));
  });

  it("two concurrent orders for the last piece: exactly one is saved", async () => {
    await db.update(product).set({ dailyLimit: 1 }).where(eq(product.id, "vanocka"));
    const a = await prepared([{ productId: "vanocka", quantity: 1 }]);
    const b = await prepared([{ productId: "vanocka", quantity: 1 }]);
    const results = await Promise.all([
      confirmDraft(db, a.draftId, STAFF, meta, now),
      confirmDraft(db, b.draftId, STAFF, meta, now),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: "over_limit" }]);
    expect(await db.select().from(order)).toHaveLength(1);
    const [cap] = await db.select().from(dailyCapacity).where(eq(dailyCapacity.productId, "vanocka"));
    expect(cap?.reserved).toBe(1);
  });

  it("an over-limit order leaves no partial capacity behind", async () => {
    await db.update(product).set({ dailyLimit: 1 }).where(eq(product.id, "vanocka"));
    const first = await prepared([{ productId: "vanocka", quantity: 1 }]);
    await confirmDraft(db, first.draftId, STAFF, meta, now);
    // draft prepared before the first confirm, so the core's informational check could not stop it
    const second = {
      ...first.p,
      lines: [
        { ...first.p.lines[0]!, productId: "rohlik", name: "Rohlík", unitPriceCzk: 4, subtotalCzk: 20, quantity: 5 },
        first.p.lines[0]!,
      ],
    };
    const draftId = await saveDraft(db, second, "phone", STAFF, now);
    expect(await confirmDraft(db, draftId, STAFF, meta, now)).toEqual({ ok: false, reason: "over_limit" });
    const [rohlik] = await db.select().from(dailyCapacity).where(eq(dailyCapacity.productId, "rohlik"));
    expect(rohlik?.reserved ?? 0).toBe(0);
  });
});

describe("confirmation and concurrency (spec 001 FR-060, FR-061; research R35)", () => {
  it("a product switched off after the read-back is refused and nothing is saved", async () => {
    const a = await prepared([
      { productId: "rohlik", quantity: 6 },
      { productId: "vanocka", quantity: 1 },
    ]);
    await db.update(product).set({ active: false }).where(eq(product.id, "vanocka"));
    expect(await confirmDraft(db, a.draftId, STAFF, meta, now)).toEqual({ ok: false, reason: "unknown_product" });
    expect(await db.select().from(order)).toHaveLength(0);
    expect(await db.select().from(dailyCapacity)).toEqual([]);
  });

  it("orders sharing products in opposite line order are all saved, none fails waiting on another", async () => {
    const pairs = 10;
    const drafts = await Promise.all(
      Array.from({ length: pairs * 2 }, (_, i) =>
        prepared(
          i % 2 === 0
            ? [
                { productId: "rohlik", quantity: 1 },
                { productId: "houska", quantity: 1 },
              ]
            : [
                { productId: "houska", quantity: 1 },
                { productId: "rohlik", quantity: 1 },
              ],
        ),
      ),
    );
    const results = await Promise.all(drafts.map((d) => confirmDraft(db, d.draftId, STAFF, meta, now)));
    expect(results.every((r) => r.ok)).toBe(true);
    const caps = await db.select().from(dailyCapacity);
    expect(caps.map((c) => c.reserved)).toEqual([pairs * 2, pairs * 2]);
  });
});

describe("hitRateLimit", () => {
  it("allows up to max hits per window", async () => {
    const hits = [];
    for (let i = 0; i < 4; i++) hits.push(await hitRateLimit(db, "call:ip", 3, 60_000, now));
    expect(hits).toEqual([true, true, true, false]);
  });
});

describe("confirmDraft checks the day again at the yes (FR-007, research R30)", () => {
  // Saturday 28 November: orders close on Friday 27 November at 14:00 Prague (13:00 UTC). The order is
  // read back at 13:58 and the customer says yes at 14:01.
  const readBack = new Date("2026-11-27T12:58:00Z");
  const afterCutoff = new Date("2026-11-27T13:01:00Z");

  it("refuses a customer's order whose yes came after the cut-off, though the read-back was before it", async () => {
    const callId = await createCall(db, {
      callerPhone: "+420777000111",
      ipHash: "x",
      promptVersion: "test",
      model: "test",
    });
    const { draftId } = await prepared([{ productId: "rohlik", quantity: 2 }], { callId }, readBack);
    expect(await confirmDraft(db, draftId, { callId }, meta, afterCutoff)).toEqual({
      ok: false,
      reason: "after_cutoff",
    });
    expect(await db.select().from(order)).toEqual([]);
  });

  it("lets staff confirm after the cut-off (their override), but not for a day that has since closed", async () => {
    const { p } = await prepared([{ productId: "rohlik", quantity: 2 }], STAFF, readBack);
    const staffDraft = await saveDraft(db, p, "staff", STAFF, readBack);
    expect(await confirmDraft(db, staffDraft, STAFF, meta, afterCutoff)).toEqual(expect.objectContaining({ ok: true }));

    const second = await saveDraft(db, p, "staff", STAFF, readBack);
    await db.insert(closedDay).values({ day: "2026-11-28", reason: "Inventura" });
    expect(await confirmDraft(db, second, STAFF, meta, readBack)).toMatchObject({ ok: false, reason: "closed_day" });
  });
});
