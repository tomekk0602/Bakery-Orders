import { NotificationList, NotificationSettings, OrderCard, PushSubscriptionCreated } from "@bakery/core/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { request, startStaffDb } from "@/test/staff-db";

// The push service is outside our system: `web-push` is replaced at its module boundary.
// `send` records the calls; `refuse` makes the push service answer with an error. The spy itself never
// throws: Vitest reports an error that passed through a spy as unhandled even when the code caught it.
const mocks = vi.hoisted(() => ({ send: vi.fn(), refuse: null as Error | null }));
vi.mock("web-push", () => {
  class WebPushError extends Error {
    constructor(
      message: string,
      readonly statusCode: number,
    ) {
      super(message);
    }
  }
  const sendNotification = async (...args: unknown[]) => {
    mocks.send(...args);
    if (mocks.refuse) throw mocks.refuse;
    return { statusCode: 201 };
  };
  return { setVapidDetails: vi.fn(), sendNotification, WebPushError };
});
// Delivery after the response runs at once here: route handlers are called without a request scope.
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (fn: () => unknown) => void fn(),
}));

let env: Awaited<ReturnType<typeof startStaffDb>>;
const ids = {} as { owner: string; employee: string };
let openDay: string;

beforeAll(async () => {
  env = await startStaffDb();
  const { db } = await import("@/server/runtime");
  const { user, loadBakery } = await import("@bakery/db");
  const { buildCalendar } = await import("@bakery/core");
  for (const u of await db().select({ id: user.id, role: user.role }).from(user))
    ids[u.role as "owner" | "employee"] = u.id;
  openDay = buildCalendar(new Date(), (await loadBakery(db())).schedule).find(
    (d) => !d.closed && d.relative !== "today",
  )!.date;
});
afterAll(async () => env?.stop());
beforeEach(() => {
  mocks.send.mockReset();
  mocks.refuse = null;
});

type Handler = (req: Request, ctx?: unknown) => Promise<Response>;
// handlers take different second arguments; the test passes the one each route expects
const ROUTES: Record<string, () => Promise<unknown>> = {
  "/api/staff/notifications": () => import("./notifications/route"),
  "/api/staff/notifications/read-all": () => import("./notifications/read-all/route"),
  "/api/staff/notification-settings": () => import("./notification-settings/route"),
  "/api/staff/push-subscriptions": () => import("./push-subscriptions/route"),
  one: () => import("./notifications/[id]/route"),
};

/** Calls a route handler as Next.js would; `params.id` selects PATCH /api/staff/notifications/:id. */
const call = async (
  path: string,
  method: string,
  cookie?: string,
  body?: unknown,
  params?: { id: string },
): Promise<Response> => {
  const route = (await ROUTES[params ? "one" : path]!()) as Record<string, Handler>;
  const req = request(params ? `/api/staff/notifications/${params.id}` : path, {
    method,
    ...(cookie ? { cookie } : {}),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return route[method]!(req, params ? { params: Promise.resolve(params) } : undefined);
};
const list = async (cookie: string) =>
  NotificationList.parse(await (await call("/api/staff/notifications", "GET", cookie)).json());
const settings = async (cookie: string) =>
  NotificationSettings.parse(await (await call("/api/staff/notification-settings", "GET", cookie)).json());

const callback = async () => {
  const { createStaffRequest } = await import("@bakery/db");
  const { db } = await import("@/server/runtime");
  return createStaffRequest(db(), {
    kind: "callback",
    origin: "agent",
    customerName: "Nováková",
    customerPhone: "+420777123456",
    note: "Zavolat",
  });
};
const device = { endpoint: "https://push.example/employee", keys: { p256dh: "p256", auth: "auth" } };
const pushedPayloads = () => mocks.send.mock.calls.map((c) => JSON.parse(c[1] as string) as Record<string, string>);

describe("the bell and the list (spec 002 FR-007, FR-008)", () => {
  it("401 without a session", async () => {
    expect((await call("/api/staff/notifications", "GET")).status).toBe(401);
  });

  it("a request reaches both roles without the customer's name; each reads only their own", async () => {
    await callback();
    const mine = await list(env.cookies.employee);
    expect(mine.unread).toBe(1);
    expect(mine.items[0]).toMatchObject({ kind: "request", title: "Nový požadavek", link: "/pozadavky" });
    expect(JSON.stringify(mine)).not.toContain("Nováková");

    const owners = (await list(env.cookies.owner)).items[0]!.id;
    expect((await call("", "PATCH", env.cookies.employee, { read: true }, { id: owners })).status).toBe(404);
    expect((await call("", "PATCH", env.cookies.employee, { read: true }, { id: mine.items[0]!.id })).status).toBe(200);
    expect((await list(env.cookies.employee)).unread).toBe(0);
    expect((await call("", "PATCH", env.cookies.employee, { read: "yes" }, { id: owners })).status).toBe(400);

    const all = await call("/api/staff/notifications/read-all", "POST", env.cookies.owner);
    expect(await all.json()).toEqual({ read: 1 });
  });
});

describe("settings (FR-014, FR-015)", () => {
  it("each role sees its kinds; an employee cannot switch on the owner's warnings", async () => {
    const s = await settings(env.cookies.employee);
    expect(s.vapidPublicKey).toBeNull();
    expect(s.kinds.find((k) => k.kind === "plan_summary")).toMatchObject({ inApp: false, push: false, allowed: true });
    expect(s.kinds.find((k) => k.kind === "assistant_down")).toMatchObject({ allowed: false });
    expect(s.quietHours).toEqual({ enabled: true, from: "20:00", to: "04:00" });

    const refused = await call("/api/staff/notification-settings", "PUT", env.cookies.employee, {
      kinds: [{ kind: "near_limit", inApp: true, push: true }],
      quietHours: s.quietHours,
    });
    expect(refused.status).toBe(403);

    const saved = await call("/api/staff/notification-settings", "PUT", env.cookies.employee, {
      kinds: [{ kind: "plan_summary", inApp: true, push: true }],
      quietHours: { enabled: true, from: "21:00", to: "05:00" },
    });
    expect(saved.status).toBe(200);
    const after = NotificationSettings.parse(await saved.json());
    expect(after.kinds.find((k) => k.kind === "plan_summary")).toMatchObject({ inApp: true, push: true });
    expect(after.quietHours).toEqual({ enabled: true, from: "21:00", to: "05:00" });
  });
});

describe("devices (FR-009, FR-011, FR-012)", () => {
  it("without VAPID keys the server says device notifications are off", async () => {
    expect((await call("/api/staff/push-subscriptions", "POST", env.cookies.employee, device)).status).toBe(503);
  });

  it("registering sends a test notification; turning off forgets the device", async () => {
    Object.assign(process.env, {
      VAPID_PUBLIC_KEY: "test-public-key",
      VAPID_PRIVATE_KEY: "test-private-key",
      VAPID_SUBJECT: "mailto:test@test.local",
    });
    expect((await settings(env.cookies.employee)).vapidPublicKey).toBe("test-public-key");
    const res = await call("/api/staff/push-subscriptions", "POST", env.cookies.employee, device);
    expect(PushSubscriptionCreated.parse(await res.json()).testSent).toBe(true);
    expect(mocks.send.mock.calls[0]![0]).toMatchObject({ endpoint: device.endpoint, keys: device.keys });
    expect((await settings(env.cookies.employee)).devices).toHaveLength(1);

    const del = await call("/api/staff/push-subscriptions", "DELETE", env.cookies.employee, {
      endpoint: device.endpoint,
    });
    expect(del.status).toBe(204);
    expect((await settings(env.cookies.employee)).devices).toHaveLength(0);
  });

  it("delivery waits out quiet hours, carries no personal data, and drops a device that is gone", async () => {
    const { deliverPushes } = await import("@/server/notifications/deliver");
    await call("/api/staff/push-subscriptions", "POST", env.cookies.employee, device);
    mocks.send.mockReset();

    const r = await callback();
    // the employee's quiet hours are 21:00–05:00 Prague; 2026-11-24 is winter time (UTC+1)
    expect(await deliverPushes(r.notificationIds, new Date("2026-11-24T21:30:00Z"))).toBe(0);
    expect(mocks.send).not.toHaveBeenCalled();

    expect(await deliverPushes(r.notificationIds, new Date("2026-11-24T09:00:00Z"))).toBe(1);
    const [payload] = pushedPayloads();
    expect(payload).toMatchObject({ title: "Nový požadavek", link: "/pozadavky" });
    expect(JSON.stringify(payload)).not.toMatch(/Nováková|777/);
    expect(await deliverPushes(r.notificationIds, new Date("2026-11-24T09:01:00Z"))).toBe(0); // once

    const webpush = await import("web-push");
    mocks.refuse = new webpush.WebPushError("gone", 410, {}, "", "");
    const again = await callback();
    expect(await deliverPushes(again.notificationIds, new Date("2026-11-24T09:00:00Z"))).toBe(0);
    expect((await settings(env.cookies.employee)).devices).toHaveLength(0);
  });
});

describe("the daily summary (FR-004, FR-005)", () => {
  const cron = async (authorization?: string) => {
    const { GET } = await import("../cron/plan-summary/route");
    return GET(
      new Request("http://localhost/api/cron/plan-summary", authorization ? { headers: { authorization } } : {}),
    );
  };

  it("needs the cron secret", async () => {
    delete process.env.CRON_SECRET;
    expect((await cron()).status).toBe(503);
    process.env.CRON_SECRET = "test-cron-secret";
    expect((await cron("Bearer wrong")).status).toBe(401);
  });

  it("goes out for the next open day, to the owner and to an employee who switched it on, once", async () => {
    const first = (await (await cron("Bearer test-cron-secret")).json()) as { day: string; created: number };
    expect(first.day).toBe(openDay);
    expect(first.created).toBe(2);
    const summary = (await list(env.cookies.owner)).items.find((n) => n.kind === "plan_summary");
    expect(summary).toMatchObject({ link: "/plan" });
    expect(summary?.title).toMatch(/^Plán na /);
    expect(((await (await cron("Bearer test-cron-secret")).json()) as { created: number }).created).toBe(0);
  });
});

describe("stage 2 (FR-017–FR-019)", () => {
  const order = async (cookie: string, quantity: number) => {
    const { POST } = await import("./orders/route");
    const card = OrderCard.parse(
      await (
        await POST(
          request("/api/staff/orders", {
            method: "POST",
            cookie,
            body: JSON.stringify({
              customerName: "Dvořák",
              customerPhone: null,
              pickupDate: openDay,
              items: [{ productId: "chleb-kminovy", quantity }],
            }),
          }),
        )
      ).json(),
    );
    const confirm = await import("./drafts/[id]/confirm/route");
    const res = await confirm.POST(request(`/api/staff/drafts/${card.draftId}/confirm`, { method: "POST", cookie }), {
      params: Promise.resolve({ id: card.draftId }),
    });
    expect(res.status).toBe(200);
  };

  it("an order added after the summary tells the others the plan changed; reaching 90% warns the owner once", async () => {
    await order(env.cookies.employee, 30);
    const owner = await list(env.cookies.owner);
    expect(owner.items.filter((n) => n.kind === "plan_changed")).toHaveLength(1);
    expect((await list(env.cookies.employee)).items.some((n) => n.kind === "plan_changed")).toBe(false);
    expect(owner.items.some((n) => n.kind === "near_limit")).toBe(false); // 30 of 40

    await order(env.cookies.employee, 6); // 36 of 40 = 90%
    await order(env.cookies.employee, 2); // still past 90%: no second warning
    const warnings = (await list(env.cookies.owner)).items.filter((n) => n.kind === "near_limit");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.title).toBe("Kmínový chléb: zbývá 4 ks");
    expect((await list(env.cookies.employee)).items.some((n) => n.kind === "near_limit")).toBe(false);
  });

  it("the assistant being down reaches the owner at most once an hour", async () => {
    const { alertAssistantDown } = await import("@/server/notifications/deliver");
    await alertAssistantDown("quota", new Date("2026-11-24T09:05:00Z"));
    await alertAssistantDown("unavailable", new Date("2026-11-24T09:45:00Z"));
    await alertAssistantDown("quota", new Date("2026-11-24T10:05:00Z"));
    expect((await list(env.cookies.owner)).items.filter((n) => n.kind === "assistant_down")).toHaveLength(2);
    expect((await list(env.cookies.employee)).items.some((n) => n.kind === "assistant_down")).toBe(false);
  });
});

describe("every new order (FR-020, FR-025)", () => {
  it("a web order reaches both roles without the customer's name; staff orders skip their author", async () => {
    const { loadBakery } = await import("@bakery/db");
    const { buildCalendar } = await import("@bakery/core");
    const { db } = await import("@/server/runtime");
    // a day well before its cut-off, so the customer's order is accepted at any time of the test run
    const day = buildCalendar(new Date(), (await loadBakery(db())).schedule).filter(
      (d) => !d.closed && d.relative === null,
    )[0]!.date;
    const { POST } = await import("../orders/route");
    const res = await POST(
      request("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName: "Jana Nováková",
          customerPhone: "+420777123456",
          pickupDate: day,
          items: [{ productId: "rohlik", quantity: 6 }],
        }),
      }),
    );
    expect(res.status).toBe(200);

    const employee = (await list(env.cookies.employee)).items.filter((n) => n.kind === "new_order");
    const owner = (await list(env.cookies.owner)).items.filter((n) => n.kind === "new_order");
    // the employee entered three orders above: the owner was told of them, the employee was not
    expect(employee).toHaveLength(1);
    expect(owner).toHaveLength(4);
    expect(employee[0]).toMatchObject({ title: "Nová objednávka", body: expect.stringMatching(/, přes web\.$/) });
    expect(employee[0]!.link).toMatch(/^\/objednavka\/[0-9a-f-]{36}$/);
    expect(JSON.stringify(employee)).not.toMatch(/Nováková|777|Rohlík/);
  });
});
