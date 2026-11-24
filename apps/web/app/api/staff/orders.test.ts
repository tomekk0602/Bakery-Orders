import { pragueDate } from "@bakery/core";
import { StaffOrderDetail, StaffOrdersResponse } from "@bakery/core/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { request, startStaffDb } from "@/test/staff-db";

let env: Awaited<ReturnType<typeof startStaffDb>>;
let orders: StaffOrdersResponse["orders"];
let day: string;

beforeAll(async () => {
  env = await startStaffDb();
  const { seedDemoOrders, loadBakery, order } = await import("@bakery/db");
  const { buildCalendar } = await import("@bakery/core");
  const { db } = await import("@/server/runtime");
  const { eq } = await import("drizzle-orm");
  // The demo puts its "today" orders on the first open day, so the test does not depend on the weekday.
  const bakery = await loadBakery(db());
  day = buildCalendar(new Date(), bakery.schedule).find((d) => !d.closed)!.date;
  await seedDemoOrders(db(), new Date(`${day}T10:00:00Z`));
  const { GET } = await import("./orders/route");
  const list = StaffOrdersResponse.parse(await (await GET(request(`/api/staff/orders?day=${day}`, { cookie: env.cookies.employee }))).json());
  orders = list.orders;
  // one cancelled order, which must not be listed or handed over
  await db().update(order).set({ status: "cancelled" }).where(eq(order.id, orders.at(-1)!.id));
});
afterAll(async () => env?.stop());

const get = async (path: string, cookie?: string) => {
  const { GET } = path.split("/").length > 4 ? await import("./orders/[id]/route") : await import("./orders/route");
  const id = path.split("/")[4]?.split("?")[0] ?? "";
  return GET(request(path, cookie ? { cookie } : {}), { params: Promise.resolve({ id }) });
};
const patch = async (id: string, status: string, cookie?: string) => {
  const { PATCH } = await import("./orders/[id]/route");
  return PATCH(request(`/api/staff/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }), ...(cookie ? { cookie } : {}) }), { params: Promise.resolve({ id }) });
};

describe("staff orders (FR-012, FR-043)", () => {
  it("401 without a session", async () => {
    expect((await get("/api/staff/orders")).status).toBe(401);
    expect((await patch(orders[0]!.id, "picked_up")).status).toBe(401);
  });

  it("defaults to today in Prague", async () => {
    const body = StaffOrdersResponse.parse(await (await get("/api/staff/orders", env.cookies.employee)).json());
    expect(body.day).toBe(pragueDate(new Date()));
  });

  it("lists a day's orders, cancelled ones excluded", async () => {
    const body = StaffOrdersResponse.parse(await (await get(`/api/staff/orders?day=${day}`, env.cookies.employee)).json());
    expect(body.orders.length).toBe(orders.length - 1);
    expect(body.orders.every((o) => o.status !== "cancelled")).toBe(true);
  });

  it("refuses a malformed day", async () => {
    expect((await get("/api/staff/orders?day=zitra", env.cookies.employee)).status).toBe(400);
  });

  it("a phone order's detail carries the call transcript", async () => {
    const phone = orders.find((o) => o.customerName === "Svobodová")!;
    const detail = StaffOrderDetail.parse(await (await get(`/api/staff/orders/${phone.id}`, env.cookies.employee)).json());
    expect(detail.transcript?.length).toBeGreaterThan(0);
    expect(detail.lines.map((l) => l.productId)).toEqual(["chleb-zitny", "rohlik"]);
  });

  it("an employee hands an order over and can undo it", async () => {
    const id = orders[0]!.id;
    expect((await patch(id, "picked_up", env.cookies.employee)).status).toBe(200);
    expect(StaffOrderDetail.parse(await (await get(`/api/staff/orders/${id}`, env.cookies.employee)).json()).status).toBe("picked_up");
    expect((await patch(id, "confirmed", env.cookies.employee)).status).toBe(200);
  });

  it("a cancelled order cannot be handed over; an unknown one is 404", async () => {
    expect((await patch(orders.at(-1)!.id, "picked_up", env.cookies.employee)).status).toBe(409);
    expect((await patch("00000000-0000-4000-8000-000000000000", "picked_up", env.cookies.employee)).status).toBe(404);
    expect((await get("/api/staff/orders/not-a-uuid", env.cookies.employee)).status).toBe(404);
  });

  it("refuses a status other than hand-over or undo", async () => {
    expect((await patch(orders[0]!.id, "cancelled", env.cookies.employee)).status).toBe(400);
  });
});
