import { BakerySettings, OrderFormResponse } from "@bakery/core/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { request, startStaffDb } from "@/test/staff-db";

let env: Awaited<ReturnType<typeof startStaffDb>>;
beforeAll(async () => {
  env = await startStaffDb();
});
afterAll(async () => env?.stop());

const get = async (cookie?: string) => {
  const { GET } = await import("./settings/route");
  return GET(request("/api/staff/settings", cookie ? { cookie } : {}));
};
const put = async (body: unknown, cookie?: string) => {
  const { PUT } = await import("./settings/route");
  return PUT(request("/api/staff/settings", { method: "PUT", body: JSON.stringify(body), ...(cookie ? { cookie } : {}) }));
};

describe("bakery settings (FR-011, FR-044)", () => {
  it("401 without a session; 403 for an employee, also for reading", async () => {
    expect((await get()).status).toBe(401);
    expect((await get(env.cookies.employee)).status).toBe(403);
    expect((await put({}, env.cookies.employee)).status).toBe(403);
  });

  it("the owner reads the settings: seven buffers per product, Sunday closed", async () => {
    const s = BakerySettings.parse(await (await get(env.cookies.owner)).json());
    expect(s.closedWeekdays).toEqual([7]);
    expect(s.cutoffTime).toBe("14:00");
    expect(s.products.find((p) => p.id === "rohlik")?.buffers).toHaveLength(7);
  });

  it("the owner changes a price, a limit and a buffer, and closes an extra day; the change is visible elsewhere", async () => {
    const s = BakerySettings.parse(await (await get(env.cookies.owner)).json());
    const rohlik = s.products.find((p) => p.id === "rohlik")!;
    const changed = {
      ...s,
      cutoffTime: "13:30",
      closedDays: [{ day: "2026-12-31", reason: "Silvestr" }],
      products: s.products.map((p) => (p.id === "rohlik" ? { ...rohlik, priceCzk: 5, dailyLimit: 300, buffers: [100, 100, 100, 100, 100, 150, 0] } : p)),
    };
    const saved = BakerySettings.parse(await (await put(changed, env.cookies.owner)).json());
    expect(saved.cutoffTime).toBe("13:30");
    expect(saved.closedDays).toEqual([{ day: "2026-12-31", reason: "Silvestr" }]);
    expect(saved.products.find((p) => p.id === "rohlik")).toMatchObject({ priceCzk: 5, dailyLimit: 300, buffers: [100, 100, 100, 100, 100, 150, 0] });

    const { GET } = await import("./order-form/route");
    const form = OrderFormResponse.parse(await (await GET(request("/api/staff/order-form", { cookie: env.cookies.employee }))).json());
    expect(form.products.find((p) => p.id === "rohlik")?.priceCzk).toBe(5);
  });

  it("a deactivated product leaves the offer", async () => {
    const s = BakerySettings.parse(await (await get(env.cookies.owner)).json());
    await put({ ...s, products: s.products.map((p) => (p.id === "vanocka" ? { ...p, active: false } : p)) }, env.cookies.owner);
    const { GET } = await import("./order-form/route");
    const form = OrderFormResponse.parse(await (await GET(request("/api/staff/order-form", { cookie: env.cookies.employee }))).json());
    expect(form.products.some((p) => p.id === "vanocka")).toBe(false);
  });

  it.each([
    ["a malformed time", { cutoffTime: "25:00" }],
    ["a zero price", { products: [{ id: "rohlik", name: "Rohlík", priceCzk: 0, dailyLimit: null, active: true, buffers: [0, 0, 0, 0, 0, 0, 0] }] }],
    ["six buffers instead of seven", { products: [{ id: "rohlik", name: "Rohlík", priceCzk: 4, dailyLimit: null, active: true, buffers: [0, 0, 0, 0, 0, 0] }] }],
    ["every weekday closed", { closedWeekdays: [1, 2, 3, 4, 5, 6, 7] }],
  ])("refuses %s", async (_label, change) => {
    const s = BakerySettings.parse(await (await get(env.cookies.owner)).json());
    expect((await put({ ...s, ...change }, env.cookies.owner)).status).toBe(400);
  });

  it("refuses an unknown product and changes nothing", async () => {
    const s = BakerySettings.parse(await (await get(env.cookies.owner)).json());
    const res = await put({ ...s, cutoffTime: "09:00", products: [...s.products, { id: "bageta", name: "Bageta", priceCzk: 30, dailyLimit: null, active: true, buffers: [0, 0, 0, 0, 0, 0, 0] }] }, env.cookies.owner);
    expect(res.status).toBe(400);
    expect(BakerySettings.parse(await (await get(env.cookies.owner)).json()).cutoffTime).not.toBe("09:00");
  });
});
