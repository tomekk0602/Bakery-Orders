import { CatalogueResponse, StaffOrdersResponse, WebOrderPlaced, WebOrderPreview } from "@bakery/core/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { request, startStaffDb } from "@/test/staff-db";

let env: Awaited<ReturnType<typeof startStaffDb>>;
let day: string;
let today: string;

beforeAll(async () => {
  env = await startStaffDb();
  const { pragueDate } = await import("@bakery/core");
  today = pragueDate(new Date());
  const { GET } = await import("../catalogue/route");
  const cat = CatalogueResponse.parse(await (await GET()).json());
  day = cat.days[0]!.date;
});
afterAll(async () => env?.stop());

const post = async (path: "/api/orders" | "/api/orders/preview", body: unknown, ip = "203.0.113.1") => {
  const { POST } = path === "/api/orders" ? await import("./route") : await import("./preview/route");
  const req = request(path, { method: "POST", body: JSON.stringify(body) });
  req.headers.set("x-forwarded-for", ip);
  return POST(req);
};
const order = (over: Record<string, unknown> = {}) => ({ customerName: "Malá", customerPhone: "+420 777 123 456", pickupDate: day, items: [{ productId: "houska", quantity: 5 }], ...over });

describe("public web form (FR-014, FR-040)", () => {
  it("the catalogue offers only days still open for orders — never today, never a closed day", async () => {
    const { GET } = await import("../catalogue/route");
    const cat = CatalogueResponse.parse(await (await GET()).json());
    expect(cat.days.some((d) => d.date === today)).toBe(false);
    expect(cat.days.every((d) => !d.closed)).toBe(true);
    expect(cat.products.some((p) => p.id === "houska")).toBe(true);
  });

  it("the preview prices the order and saves nothing", async () => {
    const preview = WebOrderPreview.parse(await (await post("/api/orders/preview", order())).json());
    expect(preview.totalCzk).toBe(30);
    expect(preview.customerPhone).toBe("+420777123456");
    const { GET } = await import("../staff/orders/route");
    const list = StaffOrdersResponse.parse(await (await GET(request(`/api/staff/orders?day=${day}`, { cookie: env.cookies.employee }))).json());
    expect(list.orders).toHaveLength(0);
  });

  it("placing saves the order with a number, source web, and staff see it", async () => {
    const placed = WebOrderPlaced.parse(await (await post("/api/orders", order())).json());
    expect(placed.orderNumber).toBeGreaterThan(1000);
    const { GET } = await import("../staff/orders/route");
    const list = StaffOrdersResponse.parse(await (await GET(request(`/api/staff/orders?day=${day}`, { cookie: env.cookies.employee }))).json());
    expect(list.orders.find((o) => o.number === placed.orderNumber)?.source).toBe("web");
  });

  it.each([
    ["today (after the cut-off)", () => order({ pickupDate: today }), 422, "after_cutoff"],
    ["a product outside the offer", () => order({ items: [{ productId: "bageta", quantity: 1 }] }), 422, "unknown_product"],
    ["no phone", () => order({ customerPhone: "" }), 400, "invalid"],
    ["no items", () => order({ items: [] }), 400, "invalid"],
  ])("refuses %s", async (_label, body, status, code) => {
    const res = await post("/api/orders", body());
    expect(res.status).toBe(status);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(code);
  });

  it("limits orders from one address", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await post("/api/orders", order(), "198.51.100.7")).status);
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
    expect((await post("/api/orders", order(), "198.51.100.8")).status).toBe(200);
  });
});
