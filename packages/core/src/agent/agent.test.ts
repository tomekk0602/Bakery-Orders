import { describe, expect, it } from "vitest";
import { buildCalendar, type BakerySchedule } from "../calendar.ts";
import type { Product } from "../catalogue.ts";
import { agentFingerprint } from "./fingerprint.ts";
import { buildInstructions } from "./prompt.ts";
import { buildToolSchemas, toolDeclarations } from "./tools.ts";
import { AGENT_FINGERPRINT, PROMPT_VERSION } from "./version.ts";
import { buildVocabulary, MAX_VOCABULARY } from "./vocabulary.ts";

const catalogue: Product[] = [
  {
    id: "chleb-kminovy",
    name: "Kmínový chléb",
    spokenForms: ["kmínové chleby"],
    priceCzk: 69,
    dailyLimit: 30,
    active: true,
  },
  {
    id: "kaiserka",
    name: "Kaiserka",
    spokenForms: ["kaiserky", "kaiserek"],
    priceCzk: 7,
    dailyLimit: null,
    active: true,
  },
  { id: "vanocka", name: "Vánočka", spokenForms: ["vánočky"], priceCzk: 120, dailyLimit: null, active: false },
];
const schedule: BakerySchedule = { closedWeekdays: [7], closedDays: [], cutoffDaysBefore: 1, cutoffTime: "14:00" };
const calendar = buildCalendar(new Date("2026-11-24T09:00:00Z"), schedule);
const schemas = buildToolSchemas(catalogue, calendar);

describe("tool schemas", () => {
  it("the product enum is exactly the active catalogue", () => {
    const decl = toolDeclarations(schemas, "customer").find((d) => d.name === "prepare_order")!;
    expect(JSON.stringify(decl.parametersJsonSchema)).toContain('"enum":["chleb-kminovy","kaiserka"]');
  });

  it("rejects a product outside the catalogue", () => {
    const r = schemas.prepare_order.safeParse({
      items: [{ product_id: "bageta", quantity: 1 }],
      pickup_date: "2026-11-25",
      customer_name: "Novák",
    });
    expect(r.success).toBe(false);
  });

  it("the pickup day is one of the calendar's open days (research R25)", () => {
    const order = { items: [{ product_id: "kaiserka", quantity: 1 }], customer_name: "Novák" };
    expect(schemas.prepare_order.safeParse({ ...order, pickup_date: "2026-11-25" }).success).toBe(true);
    // a year off, as measured in the eval, and the closed Sunday
    expect(schemas.prepare_order.safeParse({ ...order, pickup_date: "2025-11-25" }).success).toBe(false);
    expect(schemas.prepare_order.safeParse({ ...order, pickup_date: "2026-11-29" }).success).toBe(false);
  });

  it("staff mode offers no confirm_order", () => {
    expect(toolDeclarations(schemas, "staff").map((d) => d.name)).toEqual(["prepare_order"]);
  });

  it("declarations carry no $schema key", () => {
    for (const d of toolDeclarations(schemas, "customer")) expect(d.parametersJsonSchema).not.toHaveProperty("$schema");
  });
});

describe("instructions", () => {
  const text = buildInstructions({ mode: "customer", bakeryName: "Pekárna U Lípy", calendar, catalogue });

  it("contain the 14-day calendar with closed Sunday", () => {
    expect(text).toContain("2026-11-25 středa (zítra)");
    expect(text).toContain("2026-11-29 neděle — ZAVŘENO");
  });

  it("list active products with prices and no inactive one", () => {
    expect(text).toContain("kaiserka: Kaiserka, 7 Kč");
    expect(text).not.toContain("Vánočka");
  });

  it("greet with the AI disclosure", () => {
    expect(text).toContain("automatický asistent");
  });
});

describe("vocabulary", () => {
  it("holds the active products' names and forms only", () => {
    const v = buildVocabulary(catalogue, "Pekárna U Lípy");
    expect(v).toContain("kaiserek");
    expect(v).not.toContain("vánočky");
    expect(v.length).toBeLessThanOrEqual(MAX_VOCABULARY);
  });
});

describe("agent version", () => {
  it("is bumped whenever what the model receives changes", () => {
    // On failure: bump PROMPT_VERSION and set AGENT_FINGERPRINT to the received value (ADR-0012).
    expect({ PROMPT_VERSION, AGENT_FINGERPRINT }).toEqual({ PROMPT_VERSION, AGENT_FINGERPRINT: agentFingerprint() });
  });
});
