import { ConfirmDraftResponse, OrderCard, OrderFormResponse, StaffOrdersResponse } from "@bakery/core/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { request, startStaffDb } from "@/test/staff-db";

let env: Awaited<ReturnType<typeof startStaffDb>>;
let today: string;
let openDay: string;
let closedDay: string;

beforeAll(async () => {
  env = await startStaffDb();
  const { loadBakery } = await import("@bakery/db");
  const { buildCalendar, pragueDate } = await import("@bakery/core");
  const { db } = await import("@/server/runtime");
  const days = buildCalendar(new Date(), (await loadBakery(db())).schedule);
  today = pragueDate(new Date());
  openDay = days.find((d) => !d.closed && d.relative !== "today")!.date;
  closedDay = days.find((d) => d.closed)!.date;
});
afterAll(async () => env?.stop());

const prepare = async (body: unknown, cookie?: string) => {
  const { POST } = await import("./orders/route");
  return POST(request("/api/staff/orders", { method: "POST", body: JSON.stringify(body), ...(cookie ? { cookie } : {}) }));
};
const confirm = async (id: string, cookie?: string) => {
  const { POST } = await import("./drafts/[id]/confirm/route");
  return POST(request(`/api/staff/drafts/${id}/confirm`, { method: "POST", ...(cookie ? { cookie } : {}) }), { params: Promise.resolve({ id }) });
};
const order = (over: Record<string, unknown> = {}) => ({ customerName: "Nováková", customerPhone: null, pickupDate: openDay, items: [{ productId: "chleb-kminovy", quantity: 2 }, { productId: "rohlik", quantity: 6 }], ...over });

describe("staff new order (FR-013, FR-017, FR-019, FR-021)", () => {
  it("401 without a session", async () => {
    expect((await prepare(order())).status).toBe(401);
  });

  it("the form offers active products and open days only", async () => {
    const { GET } = await import("./order-form/route");
    const body = OrderFormResponse.parse(await (await GET(request("/api/staff/order-form", { cookie: env.cookies.employee }))).json());
    expect(body.products.some((p) => p.id === "rohlik")).toBe(true);
    expect(body.days.every((d) => !d.closed)).toBe(true);
  });

  it("prepares a card with prices from the core and saves nothing yet; the phone is optional", async () => {
    const card = OrderCard.parse(await (await prepare(order(), env.cookies.employee)).json());
    expect(card.totalCzk).toBe(162);
    expect(card.customerPhone).toBeNull();
    const { GET } = await import("./orders/route");
    const list = StaffOrdersResponse.parse(await (await GET(request(`/api/staff/orders?day=${openDay}`, { cookie: env.cookies.employee }))).json());
    expect(list.orders).toHaveLength(0);
  });

  it("staff may order for today, after the cut-off (FR-013)", async () => {
    const res = await prepare(order({ pickupDate: today }), env.cookies.employee);
    // today is either open (accepted despite the cut-off) or closed (refused as closed, never as cut-off)
    if (res.status === 422) expect(((await res.json()) as { error: { code: string } }).error.code).toBe("closed_day");
    else expect(res.status).toBe(200);
  });

  it.each([
    ["a closed day", () => order({ pickupDate: closedDay }), 422, "closed_day"],
    ["a product outside the offer", () => order({ items: [{ productId: "bageta", quantity: 1 }] }), 422, "unknown_product"],
    ["no items", () => order({ items: [] }), 400, "invalid"],
    ["no name", () => order({ customerName: " " }), 400, "invalid"],
    ["a malformed phone", () => order({ customerPhone: "abc" }), 400, "invalid"],
  ])("refuses %s", async (_label, body, status, code) => {
    const res = await prepare(body(), env.cookies.employee);
    expect(res.status).toBe(status);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(code);
  });

  it("confirms the employee's own draft once; the order appears with source staff", async () => {
    const card = OrderCard.parse(await (await prepare(order({ customerPhone: "+420 777 123 456" }), env.cookies.employee)).json());
    expect(card.customerPhone).toBe("+420777123456");
    const saved = ConfirmDraftResponse.parse(await (await confirm(card.draftId, env.cookies.employee)).json());
    expect((await confirm(card.draftId, env.cookies.employee)).status).toBe(404);
    const { GET } = await import("./orders/route");
    const list = StaffOrdersResponse.parse(await (await GET(request(`/api/staff/orders?day=${openDay}`, { cookie: env.cookies.employee }))).json());
    expect(list.orders.find((o) => o.number === saved.orderNumber)?.source).toBe("staff");
  });

  it("another staff member cannot confirm someone else's draft", async () => {
    const card = OrderCard.parse(await (await prepare(order(), env.cookies.employee)).json());
    expect((await confirm(card.draftId, env.cookies.owner)).status).toBe(404);
  });

  it("refuses with 409 when the daily limit is gone by the time of confirming", async () => {
    const { db } = await import("@/server/runtime");
    const { product } = await import("@bakery/db");
    const { eq } = await import("drizzle-orm");
    await db().update(product).set({ dailyLimit: 1 }).where(eq(product.id, "vanocka"));
    const a = OrderCard.parse(await (await prepare(order({ items: [{ productId: "vanocka", quantity: 1 }] }), env.cookies.employee)).json());
    const b = OrderCard.parse(await (await prepare(order({ items: [{ productId: "vanocka", quantity: 1 }] }), env.cookies.employee)).json());
    expect((await confirm(a.draftId, env.cookies.employee)).status).toBe(200);
    expect((await confirm(b.draftId, env.cookies.employee)).status).toBe(409);
  });
});
