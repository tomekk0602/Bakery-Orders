import { StaffRequestsResponse } from "@bakery/core/contracts";
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
const patch = async (id: string, done: unknown, cookie?: string) => {
  const { PATCH } = await import("./requests/[id]/route");
  return PATCH(request(`/api/staff/requests/${id}`, { method: "PATCH", body: JSON.stringify({ done }), ...(cookie ? { cookie } : {}) }), { params: Promise.resolve({ id }) });
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
    expect((await patch(id, true, env.cookies.employee)).status).toBe(200);
    let body = StaffRequestsResponse.parse(await (await list(env.cookies.employee)).json());
    expect(body.open).toHaveLength(2);
    expect(body.done[0]?.id).toBe(id);
    expect((await patch(id, false, env.cookies.employee)).status).toBe(200);
    body = StaffRequestsResponse.parse(await (await list(env.cookies.employee)).json());
    expect(body.open).toHaveLength(3);
  });

  it("404 for an unknown request, 400 for a bad body", async () => {
    expect((await patch("00000000-0000-4000-8000-000000000000", true, env.cookies.employee)).status).toBe(404);
    expect((await patch("not-a-uuid", true, env.cookies.employee)).status).toBe(404);
    const id = StaffRequestsResponse.parse(await (await list(env.cookies.employee)).json()).open[0]!.id;
    expect((await patch(id, "yes", env.cookies.employee)).status).toBe(400);
  });
});
