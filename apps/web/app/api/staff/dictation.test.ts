import { DictationResponse } from "@bakery/core/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { request, startStaffDb } from "@/test/staff-db";

// The model is replaced; everything after it — schema check, core, draft — is real. A provider failure
// is returned outside the spy: Vitest's spy tracks a rejected promise itself and reports it as unhandled.
const extract = vi.fn();
let providerFailure: unknown = null;
vi.mock("@/server/staff/dictation-model", async (original) => ({
  ...(await original<object>()),
  extractOrder: (...a: unknown[]) =>
    providerFailure
      ? Promise.reject(providerFailure)
      : Promise.resolve(extract(...a)).then((value: unknown) => ({ value, usage: {} })),
}));

let env: Awaited<ReturnType<typeof startStaffDb>>;
let day: string;
beforeAll(async () => {
  env = await startStaffDb();
  const { loadBakery } = await import("@bakery/db");
  const { buildCalendar } = await import("@bakery/core");
  const { db } = await import("@/server/runtime");
  day = buildCalendar(new Date(), (await loadBakery(db())).schedule).find(
    (d) => !d.closed && d.relative !== "today",
  )!.date;
});
afterAll(async () => env?.stop());
beforeEach(() => {
  extract.mockReset();
  providerFailure = null;
});

const dictate = async (text: string, cookie?: string) => {
  const { POST } = await import("./dictation/route");
  return POST(
    request("/api/staff/dictation", { method: "POST", body: JSON.stringify({ text }), ...(cookie ? { cookie } : {}) }),
  );
};
const said = (over: Record<string, unknown> = {}) => ({
  customerName: "Nováková",
  pickupDate: day,
  items: [{ productId: "chleb-kminovy", quantity: 2 }],
  unmatched: [],
  ...over,
});

describe("staff dictation (FR-017–FR-022, research R22)", () => {
  it("401 without a session, and the model is not called", async () => {
    expect((await dictate("dva chleby")).status).toBe(401);
    expect(extract).not.toHaveBeenCalled();
  });

  it("a complete sentence becomes an order card from the core; the model gets the enums", async () => {
    extract.mockResolvedValue(said());
    const body = DictationResponse.parse(
      await (await dictate("Nováková, dva kmínové na zítra", env.cookies.employee)).json(),
    );
    expect(body.card?.totalCzk).toBe(138);
    expect(body.missing).toEqual([]);
    const { jsonSchema, instructions } = extract.mock.calls[0]![0] as { jsonSchema: object; instructions: string };
    expect(JSON.stringify(jsonSchema)).toContain('"chleb-kminovy"');
    expect(instructions).toContain("NEDÁVEJ do items");
  });

  it("a word with no product gives candidates with names and no card (FR-020)", async () => {
    extract.mockResolvedValue(
      said({ unmatched: [{ word: "razowy", quantity: 1, candidateIds: ["chleb-celozrnny", "chleb-zitny"] }] }),
    );
    const body = DictationResponse.parse(
      await (await dictate("Nováková, dva kmínové a jeden razowy", env.cookies.employee)).json(),
    );
    expect(body.card).toBeNull();
    expect(body.unmatched[0]?.candidates).toEqual([
      { id: "chleb-celozrnny", name: "Celozrnný chléb" },
      { id: "chleb-zitny", name: "Žitný chléb" },
    ]);
  });

  it("a missing name or day gives no card and says what is missing (FR-021)", async () => {
    extract.mockResolvedValue(said({ customerName: null, pickupDate: null }));
    const body = DictationResponse.parse(await (await dictate("dva kmínové", env.cookies.employee)).json());
    expect(body.card).toBeNull();
    expect(body.missing).toEqual(["name", "day"]);
  });

  it("a rule the core refuses comes back as a refusal, not a card", async () => {
    extract.mockResolvedValue(said({ items: [{ productId: "chleb-celozrnny", quantity: 200 }] }));
    const body = DictationResponse.parse(
      await (await dictate("Nováková, dvě stě celozrnných", env.cookies.employee)).json(),
    );
    expect(body.card).toBeNull();
    expect(body.refusal?.code).toBe("over_limit");
  });

  it("an answer outside the schema (a guessed product) is refused, never turned into an order", async () => {
    extract.mockResolvedValue(said({ items: [{ productId: "bageta", quantity: 2 }] }));
    const res = await dictate("dvě bagety", env.cookies.employee);
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("dictation_unavailable");
  });

  it("an exhausted free tier says so and points to the form (FR-022)", async () => {
    const { DictationUnavailable } = await import("@/server/staff/dictation-model");
    providerFailure = new DictationUnavailable("quota");
    const res = await dictate("dva chleby", env.cookies.employee);
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: { code: string; message: string } }).error).toEqual({
      code: "quota_exhausted",
      message: "Diktování je dnes vyčerpané. Použijte formulář.",
    });
  });

  it("refuses an empty sentence without calling the model", async () => {
    expect((await dictate("   ", env.cookies.employee)).status).toBe(400);
    expect(extract).not.toHaveBeenCalled();
  });
});
