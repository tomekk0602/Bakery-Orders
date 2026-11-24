import { buildCalendar, orderTotal, priceLines, type OrderItem } from "@bakery/core";
import { sql } from "drizzle-orm";
import { loadBakery } from "./bakery.repo.ts";
import type { Db } from "./client.ts";
import { firstRow } from "./rows.ts";
import { call, dailyCapacity, order, orderLine, staffRequest } from "./schema.ts";

type DemoOrder = {
  name: string;
  phone: string | null;
  source: "phone" | "web" | "staff";
  items: OrderItem[];
  pickedUp?: boolean;
  transcript?: { role: "customer" | "agent"; text: string }[];
};

// Invented customers and orders so the demo's lists and baking plan are not empty (ADR-0014, T027).
const TODAY: DemoOrder[] = [
  {
    name: "Svobodová",
    phone: "+420602111222",
    source: "phone",
    items: [
      { productId: "chleb-zitny", quantity: 1 },
      { productId: "rohlik", quantity: 10 },
    ],
    transcript: [
      { role: "agent", text: "Dobrý den, Pekárna U Lípy, tady automatický asistent. Co si přejete?" },
      { role: "customer", text: "Dobrý den, jeden žitný chleba a deset rohlíků na zítra, Svobodová." },
      {
        role: "agent",
        text: "Jeden žitný chléb a deset rohlíků na zítra pro paní Svobodovou, celkem 105 Kč. Souhlasíte?",
      },
      { role: "customer", text: "Ano." },
      { role: "agent", text: "Děkuji, objednávka je uložená. Na shledanou." },
    ],
  },
  {
    name: "Dvořák",
    phone: "+420731444555",
    source: "web",
    items: [
      { productId: "chleb-kminovy", quantity: 2 },
      { productId: "kolac-makovy", quantity: 4 },
    ],
  },
  { name: "Kučerová", phone: null, source: "staff", items: [{ productId: "croissant", quantity: 6 }], pickedUp: true },
  {
    name: "Procházka",
    phone: "+420608777888",
    source: "phone",
    items: [
      { productId: "houska", quantity: 8 },
      { productId: "kaiserka", quantity: 4 },
    ],
  },
];
const LATER: DemoOrder[] = [
  {
    name: "Novotná",
    phone: "+420777100200",
    source: "web",
    items: [
      { productId: "chleb-celozrnny", quantity: 1 },
      { productId: "rohlik", quantity: 6 },
    ],
  },
  {
    name: "Veselý",
    phone: null,
    source: "staff",
    items: [
      { productId: "kolac-tvarohovy", quantity: 10 },
      { productId: "kolac-povidlovy", quantity: 10 },
    ],
  },
  {
    name: "Horáková",
    phone: "+420605300400",
    source: "phone",
    items: [
      { productId: "buchta-povidlova", quantity: 3 },
      { productId: "chleb-kminovy", quantity: 1 },
    ],
  },
];

async function insertOrder(db: Db, day: string, o: DemoOrder): Promise<void> {
  const bakery = await loadBakery(db);
  const lines = priceLines(o.items, bakery.catalogue);
  const callId = o.transcript
    ? firstRow(
        await db
          .insert(call)
          .values({
            callerPhone: o.phone ?? "",
            ipHash: "demo",
            promptVersion: "demo",
            model: "demo",
            outcome: "order",
            transcript: o.transcript,
            endedAt: new Date(),
          })
          .returning({ id: call.id }),
        "demo call",
      ).id
    : null;
  const saved = firstRow(
    await db
      .insert(order)
      .values({
        source: o.source,
        status: o.pickedUp ? "picked_up" : "confirmed",
        customerName: o.name,
        customerPhone: o.phone,
        pickupDay: day,
        totalCzk: orderTotal(lines),
        callId,
      })
      .returning({ id: order.id }),
    "demo order",
  );
  await db.insert(orderLine).values(
    lines.map((l) => ({
      orderId: saved.id,
      productId: l.productId,
      quantity: l.quantity,
      unitPriceCzk: l.unitPriceCzk,
    })),
  );
  for (const l of lines)
    await db
      .insert(dailyCapacity)
      .values({ productId: l.productId, day, reserved: l.quantity })
      .onConflictDoUpdate({
        target: [dailyCapacity.productId, dailyCapacity.day],
        set: { reserved: sql`${dailyCapacity.reserved} + ${l.quantity}` },
      });
}

/** Orders for today (if open) and the next open days. Separate from seedBakery so tests start empty. */
export async function seedDemoOrders(db: Db, now = new Date()): Promise<void> {
  const bakery = await loadBakery(db);
  const open = buildCalendar(now, bakery.schedule, 7).filter((d) => !d.closed);
  for (const [i, day] of open.entries()) {
    const batch = day.relative === "today" ? TODAY : LATER.slice(0, 1 + (i % LATER.length));
    for (const o of batch) await insertOrder(db, day.date, o);
  }
}

/** Requests for staff, so "Požadavky" is not empty in the demo: one per kind and origin (FR-008, FR-034). */
export async function seedDemoRequests(db: Db, now = new Date()): Promise<void> {
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
  const callRow = firstRow(
    await db
      .insert(call)
      .values({
        callerPhone: "+420604555666",
        ipHash: "demo",
        promptVersion: "demo",
        model: "demo",
        outcome: "request",
        endedAt: minutesAgo(40),
        transcript: [
          { role: "agent", text: "Dobrý den, Pekárna U Lípy, tady automatický asistent. Co si přejete?" },
          { role: "customer", text: "Dobrý den, chtěla bych objednat dort na narozeniny, ale nevím jaký." },
          { role: "agent", text: "Dorty v nabídce nemáme. Mám zapsat, aby vám zavolal kolega?" },
          { role: "customer", text: "Ano, prosím. Bartošová." },
          { role: "agent", text: "Zapsáno, kolega se vám ozve. Na shledanou." },
        ],
      })
      .returning({ id: call.id }),
    "demo request call",
  );
  await db.insert(staffRequest).values([
    {
      kind: "callback",
      origin: "agent",
      customerName: "Bartošová",
      customerPhone: "+420604555666",
      note: "Ptá se na dort k narozeninám, není v nabídce.",
      callId: callRow.id,
      createdAt: minutesAgo(40),
    },
    {
      kind: "change",
      origin: "agent",
      customerName: "Dvořák",
      customerPhone: "+420731444555",
      note: "Chce místo dvou kmínových chlebů dva žitné.",
      createdAt: minutesAgo(25),
    },
    {
      kind: "callback",
      origin: "promised_not_recorded",
      customerName: null,
      customerPhone: "+420775888999",
      note: "Asistent slíbil zpětné zavolání, ale požadavek nezapsal.",
      createdAt: minutesAgo(10),
    },
  ]);
}
