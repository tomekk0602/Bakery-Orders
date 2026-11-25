import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderError, placeOrder, previewOrder } from "./api";
const input = {
  customerName: "Test",
  customerPhone: "+420777000111",
  pickupDate: "2026-11-25",
  items: [{ productId: "rohlik", quantity: 2 }],
};
const confirm = { draftId: "11111111-1111-4111-8111-111111111111", token: "t".repeat(43) };
afterEach(() => vi.unstubAllGlobals());
describe("reservation network failures", () => {
  it("marks a lost POST response uncertain and never retries on its own; the customer may retry safely", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", fetch);
    await expect(placeOrder(confirm)).rejects.toMatchObject({ uncertain: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("keeps ordinary validation failures recoverable", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: { code: "invalid", message: "Vyberte den." } }), { status: 400 }),
        ),
    );
    await expect(previewOrder(input)).rejects.toMatchObject({ uncertain: false });
  });
  it("treats a server error after POST as an unknown save outcome", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad gateway", { status: 502 })));
    await expect(placeOrder(confirm)).rejects.toBeInstanceOf(OrderError);
    await expect(placeOrder(confirm)).rejects.toMatchObject({ uncertain: true });
  });
});
