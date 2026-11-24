import { prepareOrder, type PreparedOrder } from "@bakery/core";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "./client.ts";
import { loadBakery, remainingCapacity } from "./bakery.repo.ts";
import { createCall, hitRateLimit } from "./calls.repo.ts";
import { confirmDraft, saveDraft } from "./orders.repo.ts";
import { dailyCapacity, order, product } from "./schema.ts";
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
});

async function prepared(items: { productId: string; quantity: number }[], callId: string | null = null): Promise<{ draftId: string; p: PreparedOrder }> {
  const bakery = await loadBakery(db);
  const remaining = await remainingCapacity(db, bakery.catalogue, "2026-11-28");
  const p = prepareOrder(
    { items, pickupDate: "2026-11-28", customerName: "Nováková", customerPhone: "+420777000111" },
    { now, channel: "phone", catalogue: bakery.catalogue, schedule: bakery.schedule, staffOverride: false, remaining },
  );
  if (!p.ok) throw new Error(`prepare refused: ${p.reason}`);
  return { draftId: await saveDraft(db, p, "phone", callId, now), p };
}

const meta = { callId: null, promptVersion: "test", model: "test" };

describe("confirmDraft", () => {
  it("saves the order, its lines and the capacity in one go", async () => {
    const { draftId } = await prepared([{ productId: "chleb-kminovy", quantity: 2 }, { productId: "rohlik", quantity: 6 }]);
    const r = await confirmDraft(db, draftId, null, meta, now);
    expect(r).toEqual(expect.objectContaining({ ok: true, orderNumber: 1001 }));
    const [saved] = await db.select().from(order);
    expect(saved?.totalCzk).toBe(162);
    const [cap] = await db.select().from(dailyCapacity).where(eq(dailyCapacity.productId, "chleb-kminovy"));
    expect(cap?.reserved).toBe(2);
  });

  it("confirms a draft only once", async () => {
    const { draftId } = await prepared([{ productId: "rohlik", quantity: 1 }]);
    await confirmDraft(db, draftId, null, meta, now);
    expect(await confirmDraft(db, draftId, null, meta, now)).toEqual({ ok: false, reason: "no_draft" });
  });

  it("refuses a draft from another call", async () => {
    const callId = await createCall(db, { callerPhone: "+420777000111", ipHash: "x", promptVersion: "test", model: "test" });
    const otherCall = await createCall(db, { callerPhone: "+420777000222", ipHash: "y", promptVersion: "test", model: "test" });
    const { draftId } = await prepared([{ productId: "rohlik", quantity: 1 }], callId);
    expect(await confirmDraft(db, draftId, otherCall, meta, now)).toEqual({ ok: false, reason: "no_draft" });
  });

  it("two concurrent orders for the last piece: exactly one is saved", async () => {
    await db.update(product).set({ dailyLimit: 1 }).where(eq(product.id, "vanocka"));
    const a = await prepared([{ productId: "vanocka", quantity: 1 }]);
    const b = await prepared([{ productId: "vanocka", quantity: 1 }]);
    const results = await Promise.all([confirmDraft(db, a.draftId, null, meta, now), confirmDraft(db, b.draftId, null, meta, now)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: "over_limit" }]);
    expect(await db.select().from(order)).toHaveLength(1);
    const [cap] = await db.select().from(dailyCapacity).where(eq(dailyCapacity.productId, "vanocka"));
    expect(cap?.reserved).toBe(1);
  });

  it("an over-limit order leaves no partial capacity behind", async () => {
    await db.update(product).set({ dailyLimit: 1 }).where(eq(product.id, "vanocka"));
    const first = await prepared([{ productId: "vanocka", quantity: 1 }]);
    await confirmDraft(db, first.draftId, null, meta, now);
    // draft prepared before the first confirm, so the core's informational check could not stop it
    const second = { ...first.p, lines: [{ ...first.p.lines[0]!, productId: "rohlik", name: "Rohlík", unitPriceCzk: 4, subtotalCzk: 20, quantity: 5 }, first.p.lines[0]!] };
    const draftId = await saveDraft(db, second, "phone", null, now);
    expect(await confirmDraft(db, draftId, null, meta, now)).toEqual({ ok: false, reason: "over_limit" });
    const [rohlik] = await db.select().from(dailyCapacity).where(eq(dailyCapacity.productId, "rohlik"));
    expect(rohlik?.reserved ?? 0).toBe(0);
  });
});

describe("hitRateLimit", () => {
  it("allows up to max hits per window", async () => {
    const hits = [];
    for (let i = 0; i < 4; i++) hits.push(await hitRateLimit(db, "call:ip", 3, 60_000, now));
    expect(hits).toEqual([true, true, true, false]);
  });
});
