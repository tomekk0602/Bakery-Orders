import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { request, startStaffDb } from "@/test/staff-db";

let env: Awaited<ReturnType<typeof startStaffDb>>;
beforeAll(async () => {
  env = await startStaffDb();
});
afterAll(async () => env?.stop());

describe("staff routes check permissions on the server (FR-043, SC-012)", () => {
  it("GET /api/staff/me → 401 without a session", async () => {
    const { GET } = await import("./me/route");
    expect((await GET(request("/api/staff/me"))).status).toBe(401);
  });

  it("GET /api/staff/me → the employee and their permissions", async () => {
    const { GET } = await import("./me/route");
    const res = await GET(request("/api/staff/me", { cookie: env.cookies.employee }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { role: string }; permissions: string[] };
    expect(body.user.role).toBe("employee");
    expect(body.permissions).toContain("plan:view");
    expect(body.permissions).not.toContain("settings:edit");
  });

  it("POST /api/staff/reset → 403 for an employee (FR-044)", async () => {
    const { POST } = await import("./reset/route");
    const res = await POST(request("/api/staff/reset", { method: "POST", cookie: env.cookies.employee }));
    expect(res.status).toBe(403);
  });

  it("POST /api/staff/reset → 200 for the owner", async () => {
    const { POST } = await import("./reset/route");
    expect((await POST(request("/api/staff/reset", { method: "POST", cookie: env.cookies.owner }))).status).toBe(200);
  });
});

describe("Reset demo (FR-042, FR-081)", () => {
  it("empties the bell and restores the seeded orders", async () => {
    const { db } = await import("@/server/runtime");
    const { notification, order, user } = await import("@bakery/db");
    const { NOTIFICATION_KINDS } = await import("@bakery/core");
    const [owner] = await db().select({ id: user.id }).from(user).limit(1);
    await db().insert(notification).values({
      recipientId: owner!.id,
      kind: NOTIFICATION_KINDS[0],
      subject: "order:gone",
      title: "Nová objednávka",
      body: "č. 1001",
      link: "/objednavka/gone",
      inApp: true,
      push: false,
    });
    const { POST } = await import("./reset/route");
    expect((await POST(request("/api/staff/reset", { method: "POST", cookie: env.cookies.owner }))).status).toBe(200);
    expect(await db().select().from(notification)).toEqual([]);
    expect((await db().select({ id: order.id }).from(order)).length).toBeGreaterThan(0);
  });
});
