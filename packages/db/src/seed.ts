import { sql } from "drizzle-orm";
import type { Executor } from "./client.ts";
import { bakerySettings, product, walkInBuffer } from "./schema.ts";

/** "Pekárna U Lípy" — an invented bakery for the demo (ADR-0014). Prices are illustrative. */
export const SEED_PRODUCTS = [
  {
    id: "chleb-kminovy",
    name: "Kmínový chléb",
    spokenForms: ["kmínový chleba", "kmínové chleby", "kmínových chlebů", "kmínový"],
    priceCzk: 69,
    dailyLimit: 40,
  },
  {
    id: "chleb-zitny",
    name: "Žitný chléb",
    spokenForms: ["žitný chleba", "žitné chleby", "žitných chlebů", "žitný"],
    priceCzk: 65,
    dailyLimit: 30,
  },
  {
    id: "chleb-celozrnny",
    name: "Celozrnný chléb",
    spokenForms: ["celozrnný chleba", "celozrnné chleby", "celozrnných chlebů"],
    priceCzk: 75,
    dailyLimit: 20,
  },
  { id: "rohlik", name: "Rohlík", spokenForms: ["rohlíky", "rohlíků"], priceCzk: 4, dailyLimit: null },
  { id: "houska", name: "Houska", spokenForms: ["housky", "housek"], priceCzk: 6, dailyLimit: null },
  { id: "kaiserka", name: "Kaiserka", spokenForms: ["kaiserky", "kaiserek"], priceCzk: 7, dailyLimit: null },
  {
    id: "kolac-tvarohovy",
    name: "Tvarohový koláč",
    spokenForms: ["tvarohové koláče", "tvarohových koláčů", "tvarohový"],
    priceCzk: 18,
    dailyLimit: 60,
  },
  {
    id: "kolac-makovy",
    name: "Makový koláč",
    spokenForms: ["makové koláče", "makových koláčů", "makový"],
    priceCzk: 18,
    dailyLimit: 60,
  },
  {
    id: "kolac-povidlovy",
    name: "Povidlový koláč",
    spokenForms: ["povidlové koláče", "povidlových koláčů"],
    priceCzk: 18,
    dailyLimit: 60,
  },
  {
    id: "buchta-povidlova",
    name: "Povidlová buchta",
    spokenForms: ["povidlové buchty", "povidlových buchet"],
    priceCzk: 22,
    dailyLimit: 40,
  },
  {
    id: "croissant",
    name: "Máslový croissant",
    spokenForms: ["croissanty", "croissantů", "loupák", "loupáky"],
    priceCzk: 32,
    dailyLimit: 40,
  },
  { id: "vanocka", name: "Vánočka", spokenForms: ["vánočky", "vánoček"], priceCzk: 120, dailyLimit: 15 },
] as const;

/** Walk-in buffer per product: weekdays, and a larger Saturday (ISO weekday 6). Proposed values. */
const BUFFER_WEEKDAY: Record<string, number> = {
  "chleb-kminovy": 15,
  "chleb-zitny": 10,
  "chleb-celozrnny": 6,
  rohlik: 120,
  houska: 80,
  kaiserka: 40,
  "kolac-tvarohovy": 20,
  "kolac-makovy": 20,
  "kolac-povidlovy": 15,
  "buchta-povidlova": 12,
  croissant: 20,
  vanocka: 4,
};

export async function seedBakery(db: Executor): Promise<void> {
  await db
    .insert(bakerySettings)
    .values({
      id: 1,
      name: "Pekárna U Lípy",
      cutoffDaysBefore: 1,
      cutoffTime: "14:00",
      closedWeekdays: [7],
      callCapSeconds: 180,
    })
    .onConflictDoNothing();
  await db
    .insert(product)
    .values(SEED_PRODUCTS.map((p, i) => ({ ...p, spokenForms: [...p.spokenForms], active: true, sortOrder: i })))
    .onConflictDoNothing();
  const buffers = SEED_PRODUCTS.flatMap((p) =>
    [1, 2, 3, 4, 5, 6].map((weekday) => ({
      productId: p.id,
      weekday,
      quantity: Math.round((BUFFER_WEEKDAY[p.id] ?? 0) * (weekday === 6 ? 1.5 : 1)),
    })),
  );
  await db.insert(walkInBuffer).values(buffers).onConflictDoNothing();
}

/** Removes all bakery data (orders, calls, requests, catalogue) — used by tests and "Reset demo". */
export async function truncateBakery(db: Executor): Promise<void> {
  await db.execute(
    sql`TRUNCATE notification, order_line, "order", order_draft, staff_request, daily_capacity, "call", rate_limit, walk_in_buffer, product, closed_day, bakery_settings RESTART IDENTITY CASCADE`,
  );
  await db.execute(sql`ALTER SEQUENCE order_number_seq RESTART WITH 1001`);
}
