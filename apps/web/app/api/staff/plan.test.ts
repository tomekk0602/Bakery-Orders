import { BakingPlanResponse } from "@bakery/core/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { request, startStaffDb } from "@/test/staff-db";

let env: Awaited<ReturnType<typeof startStaffDb>>;
let day: string;

beforeAll(async () => {
  env = await startStaffDb();
  const { seedDemoOrders, loadBakery, order } = await import("@bakery/db");
  const { buildCalendar } = await import("@bakery/core");
  const { db } = await import("@/server/runtime");
  const { and, eq } = await import("drizzle-orm");
  const bakery = await loadBakery(db());
  day = buildCalendar(new Date(), bakery.schedule).find((d) => !d.closed)!.date;
  // The demo's "today" set lands on `day`: Svobodová 1 žitný + 10 rohlíků, Dvořák 2 kmínové + 4 makové,
  // Kučerová 6 croissantů (handed over), Procházka 8 housek + 4 kaiserky.
  await seedDemoOrders(db(), new Date(`${day}T10:00:00Z`));
  // Procházka cancels: his pieces must leave the plan.
  await db()
    .update(order)
    .set({ status: "cancelled" })
    .where(and(eq(order.pickupDay, day), eq(order.customerName, "Procházka")));
});
afterAll(async () => env?.stop());

const plan = async (query: string, cookie?: string) => {
  const { GET } = await import("./plan/route");
  return GET(request(`/api/staff/plan${query}`, cookie ? { cookie } : {}));
};

describe("baking plan (FR-010, FR-044)", () => {
  it("401 without a session", async () => {
    expect((await plan("")).status).toBe(401);
  });

  it("an employee reads the plan: ordered + buffer = to bake, cancelled and picked-up handled", async () => {
    const body = BakingPlanResponse.parse(await (await plan(`?day=${day}`, env.cookies.employee)).json());
    const line = (id: string) => body.lines.find((l) => l.productId === id)!;
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay() || 7;
    const factor = weekday === 6 ? 1.5 : 1;
    expect(line("rohlik")).toMatchObject({
      reserved: 10,
      buffer: Math.round(120 * factor),
      toBake: 10 + Math.round(120 * factor),
    });
    expect(line("croissant").reserved).toBe(6); // handed over still had to be baked
    expect(line("houska").reserved).toBe(0); // cancelled
    expect(body.totals.toBake).toBe(body.lines.reduce((s, l) => s + l.toBake, 0));
  });

  it("without a day it shows the next open day after today, and lists days to switch to", async () => {
    const body = BakingPlanResponse.parse(await (await plan("", env.cookies.employee)).json());
    expect(body.day.relative).not.toBe("today");
    expect(body.day.closed).toBe(false);
    expect(body.days).toHaveLength(14);
  });

  it("a closed day has no buffer", async () => {
    const { db } = await import("@/server/runtime");
    const { loadBakery } = await import("@bakery/db");
    const { buildCalendar } = await import("@bakery/core");
    const closed = buildCalendar(new Date(), (await loadBakery(db())).schedule).find((d) => d.closed)!;
    const body = BakingPlanResponse.parse(await (await plan(`?day=${closed.date}`, env.cookies.employee)).json());
    expect(body.day.closed).toBe(true);
    expect(body.totals.buffer).toBe(0);
  });

  it("refuses a malformed day", async () => {
    expect((await plan("?day=zitra", env.cookies.employee)).status).toBe(400);
    // a well-formed but impossible date never reaches the database (spec 001 FR-063)
    expect((await plan("?day=2026-99-99", env.cookies.employee)).status).toBe(400);
  });
});
