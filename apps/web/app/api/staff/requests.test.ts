import { RequestArchivePage, StaffRequestsResponse } from "@bakery/core/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { request, startStaffDb } from "@/test/staff-db";

let env: Awaited<ReturnType<typeof startStaffDb>>;
beforeAll(async () => {
  env = await startStaffDb();
  const { seedDemoRequests } = await import("@bakery/db");
  const { db } = await import("@/server/runtime");
  await seedDemoRequests(db());
});
afterAll(async () => env?.stop());

const list = async (cookie?: string) => {
  const { GET } = await import("./requests/route");
  return GET(request("/api/staff/requests", cookie ? { cookie } : {}));
};
const patch = async (id: string, body: unknown, cookie?: string) => {
  const { PATCH } = await import("./requests/[id]/route");
  return PATCH(
    request(`/api/staff/requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      ...(cookie ? { cookie } : {}),
    }),
    { params: Promise.resolve({ id }) },
  );
};

describe("staff requests (FR-008, FR-034, FR-041)", () => {
  it("401 without a session", async () => {
    expect((await list()).status).toBe(401);
  });

  it("lists open requests oldest first; a call's request carries its transcript", async () => {
    const body = StaffRequestsResponse.parse(await (await list(env.cookies.employee)).json());
    expect(body.open.map((r) => r.customerName ?? r.origin)).toEqual(["Bartošová", "Dvořák", "promised_not_recorded"]);
    expect(body.open[0]?.transcript?.length).toBeGreaterThan(0);
    expect(body.open[1]?.transcript).toBeNull();
  });

  it("an employee marks a request handled and can reopen it", async () => {
    const id = StaffRequestsResponse.parse(await (await list(env.cookies.employee)).json()).open[0]!.id;
    expect((await patch(id, { action: "handled", note: "domluveno" }, env.cookies.employee)).status).toBe(200);
    let body = StaffRequestsResponse.parse(await (await list(env.cookies.employee)).json());
    expect(body.open).toHaveLength(2);
    expect(body.closedToday[0]?.id).toBe(id);
    expect(body.closedToday[0]).toMatchObject({ outcome: "handled" });
    expect(body.closedToday[0]?.history.at(-1)).toMatchObject({ kind: "handled", by: "employee", note: "domluveno" });
    expect((await patch(id, { action: "reopen" }, env.cookies.employee)).status).toBe(200);
    body = StaffRequestsResponse.parse(await (await list(env.cookies.employee)).json());
    expect(body.open).toHaveLength(3);
  });

  it("404 for an unknown request, 400 for a bad body", async () => {
    const handled = { action: "handled" };
    expect((await patch("00000000-0000-4000-8000-000000000000", handled, env.cookies.employee)).status).toBe(404);
    expect((await patch("not-a-uuid", handled, env.cookies.employee)).status).toBe(404);
    const id = StaffRequestsResponse.parse(await (await list(env.cookies.employee)).json()).open[0]!.id;
    expect((await patch(id, { done: true }, env.cookies.employee)).status).toBe(400);
  });

  it("unanswered calls count; unreachable only from the third (FR-048, FR-049)", async () => {
    const open = StaffRequestsResponse.parse(await (await list(env.cookies.employee)).json()).open;
    const id = open.find((r) => r.kind === "callback")!.id;
    expect((await patch(id, { action: "call" }, env.cookies.employee)).status).toBe(200);
    let item = StaffRequestsResponse.parse(await (await list(env.cookies.owner)).json()).open.find((r) => r.id === id);
    expect(item?.callingNow).toEqual({ name: "employee" });
    for (let i = 0; i < 2; i++) await patch(id, { action: "unanswered" }, env.cookies.employee);
    const early = await patch(id, { action: "unreachable" }, env.cookies.employee);
    expect(early.status).toBe(422);
    await patch(id, { action: "unanswered" }, env.cookies.owner);
    item = StaffRequestsResponse.parse(await (await list(env.cookies.owner)).json()).open.find((r) => r.id === id);
    expect(item).toMatchObject({ attempts: 3, canCloseUnreachable: true, callingNow: null });
    expect((await patch(id, { action: "unreachable" }, env.cookies.owner)).status).toBe(200);
    expect((await patch(id, { action: "handled" }, env.cookies.owner)).status).toBe(409);
  });
});

describe("cancelling from a request (FR-052, SC-014)", () => {
  it("cancels the customer's order and closes the request in one step", async () => {
    const { db } = await import("@/server/runtime");
    const { createStaffRequest, order, orderLine } = await import("@bakery/db");
    const { pragueDate } = await import("@bakery/core");
    const day = pragueDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const [o] = await db()
      .insert(order)
      .values({
        source: "phone",
        customerName: "Svoboda",
        customerPhone: "+420 608 111 222",
        pickupDay: day,
        totalCzk: 24,
      })
      .returning();
    await db().insert(orderLine).values({ orderId: o!.id, productId: "rohlik", quantity: 6, unitPriceCzk: 4 });
    const { id } = await createStaffRequest(db(), {
      kind: "cancel",
      origin: "agent",
      customerName: "Svoboda",
      customerPhone: "+420608111222",
      note: "Chce zrušit objednávku na zítra.",
    });

    const item = StaffRequestsResponse.parse(await (await list(env.cookies.employee)).json()).open.find(
      (r) => r.id === id,
    );
    expect(item?.orders.map((x) => x.number)).toEqual([o!.number]);

    const { POST } = await import("./requests/[id]/cancel-order/route");
    const cancel = (orderId: string) =>
      POST(
        request(`/api/staff/requests/${id}/cancel-order`, {
          method: "POST",
          body: JSON.stringify({ orderId }),
          cookie: env.cookies.employee,
        }),
        { params: Promise.resolve({ id }) },
      );
    const res = await cancel(o!.id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, orderNumber: o!.number });
    const done = StaffRequestsResponse.parse(await (await list(env.cookies.employee)).json()).closedToday.find(
      (r) => r.id === id,
    );
    expect(done?.history.at(-1)).toMatchObject({ kind: "order_cancelled", orderNumber: o!.number });
    expect((await cancel(o!.id)).status).toBe(409); // the request is closed now
  });
});

describe("the owner's archive (FR-054, FR-055)", () => {
  const archive = async (query: string, cookie?: string) => {
    const { GET } = await import("./requests/archive/route");
    return GET(request(`/api/staff/requests/archive${query}`, cookie ? { cookie } : {}));
  };

  it("only the owner opens it; it holds requests closed before today", async () => {
    const { db } = await import("@/server/runtime");
    const { actOnRequest, createStaffRequest, user } = await import("@bakery/db");
    const { eq } = await import("drizzle-orm");
    const [owner] = await db().select({ id: user.id }).from(user).where(eq(user.role, "owner"));
    const { id } = await createStaffRequest(db(), {
      kind: "callback",
      origin: "agent",
      customerName: "Archivní Zákazník",
      customerPhone: "+420600123456",
      note: "Zavolat",
    });
    await actOnRequest(db(), {
      id,
      userId: owner!.id,
      action: "handled",
      now: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    });

    expect((await archive("", env.cookies.employee)).status).toBe(403);
    expect((await archive("")).status).toBe(401);
    const res = await archive("?q=archivn%C3%AD&outcome=handled", env.cookies.owner);
    expect(res.status).toBe(200);
    const page = RequestArchivePage.parse(await res.json());
    expect(page.items.map((r) => r.id)).toEqual([id]);
    expect((await archive("?outcome=lost", env.cookies.owner)).status).toBe(400);
  });
});
