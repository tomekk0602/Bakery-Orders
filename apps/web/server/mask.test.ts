import { describe, expect, it } from "vitest";
import { MASKED, maskPersonalData } from "./mask";

describe("masking before a trace leaves the server", () => {
  it("masks names and phones by key, at any depth", () => {
    const args = {
      customer_name: "Nováková",
      items: [{ product_id: "rohlik", quantity: 2 }],
      caller: { callerPhone: "+420777123456" },
    };
    expect(maskPersonalData(args)).toEqual({
      customer_name: MASKED,
      items: [{ product_id: "rohlik", quantity: 2 }],
      caller: { callerPhone: MASKED },
    });
  });

  it("masks a phone number written inside any string", () => {
    expect(maskPersonalData("volal z +420 777 123 456 kvůli objednávce")).toBe(`volal z ${MASKED} kvůli objednávce`);
  });

  it("keeps dates, prices, order numbers and ids", () => {
    const result = {
      ok: true,
      draft_id: "4b3c82fc-7e7c-40aa-b6e8-2b5278b7a25a",
      total_czk: 162,
      pickup_date: "2026-11-28",
      order_number: 1001,
    };
    expect(maskPersonalData(result)).toEqual(result);
  });

  it("masks inside a serialised payload, as the trace SDK hands it over (found on the first traced call)", () => {
    const input = JSON.stringify({
      items: [{ product_id: "rohlik", quantity: 2 }],
      customer_name: "Novák",
      pickup_date: "2026-11-25",
    });
    expect(JSON.parse(maskPersonalData(input) as string)).toEqual({
      items: [{ product_id: "rohlik", quantity: 2 }],
      customer_name: MASKED,
      pickup_date: "2026-11-25",
    });
    const output = JSON.stringify({ customerName: "Nováková", items: [{ productId: "rohlik", quantity: 6 }] });
    expect(maskPersonalData(output)).toBe(
      JSON.stringify({ customerName: MASKED, items: [{ productId: "rohlik", quantity: 6 }] }),
    );
  });

  it("keeps product names in tool results", () => {
    const lines = { lines: [{ name: "Rohlík", quantity: 2 }] };
    expect(maskPersonalData(lines)).toEqual(lines);
  });

  it("leaves an absent name absent", () => {
    expect(maskPersonalData({ customerName: null })).toEqual({ customerName: null });
  });
});
