// Shared catalogue, prompt, tools and scoring for the Czech voice spike.
// Both providers get the same instructions and the same tools, so the numbers compare.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

// "Today" is fixed so relative days ("zítra", "v sobotu") have one right answer.
export const TODAY = "2026-11-24"; // Tuesday

export const CATALOGUE = [
  { id: "chleb-kminovy", name: "Kmínový chléb", price: 69 },
  { id: "chleb-zitny", name: "Žitný chléb", price: 65 },
  { id: "chleb-celozrnny", name: "Celozrnný chléb", price: 75 },
  { id: "rohlik", name: "Rohlík", price: 4 },
  { id: "houska", name: "Houska", price: 6 },
  { id: "kaiserka", name: "Kaiserka", price: 7 },
  { id: "kolac-tvarohovy", name: "Tvarohový koláč", price: 18 },
  { id: "kolac-makovy", name: "Makový koláč", price: 18 },
  { id: "buchta-povidlova", name: "Povidlová buchta", price: 22 },
  { id: "croissant", name: "Máslový croissant", price: 32 },
];

// Speech vocabulary (ADR-0010 point 3): product names with the inflected forms a caller says,
// plus words the recognisers missed in R7 ("pět kaiserek" heard as "Pětka, Serek", "pět kalaret").
export const VOCABULARY = [
  "kmínový chléb", "kmínové chleby", "žitný chléb", "celozrnný chléb", "celozrnné chleby",
  "rohlík", "rohlíky", "rohlíků", "houska", "housky", "housek",
  "kaiserka", "kaiserky", "kaiserek", "tvarohový koláč", "tvarohových", "makový koláč", "makových",
  "povidlová buchta", "povidlové buchty", "máslový croissant", "croissanty", "croissantů",
  "pozítří", "Pekárna U Lípy",
];

// Run 1 showed the model miscounting relative days ("pozítří", "v sobotu") by one. Dates are not
// left to the model's arithmetic: the code writes out the next 14 days and the model only looks up.
const CLOSED_WEEKDAYS = [0]; // Sunday
function calendar(days = 14) {
  const start = new Date(`${TODAY}T12:00:00Z`);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start.getTime() + i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    const name = d.toLocaleDateString("cs-CZ", { weekday: "long", timeZone: "UTC" });
    const tag = i === 0 ? " (dnes)" : i === 1 ? " (zítra)" : i === 2 ? " (pozítří)" : "";
    return `${iso} ${name}${tag}${CLOSED_WEEKDAYS.includes(d.getUTCDay()) ? " — ZAVŘENO" : ""}`;
  }).join("\n");
}

export const INSTRUCTIONS = `Jsi telefonní asistent Pekárny U Lípy. Mluvíš vždy česky, krátce a zdvořile.
Kalendář (data NIKDY nepočítej, vždy je vyhledej zde; "příští pondělí" = nejbližší pondělí po dnešku):
${calendar()}
Pravidla:
- Produkty a ceny znáš JEN z nástroje list_products. Nikdy si produkt ani cenu nevymýšlej.
- Když zákazník chce produkt, který v nabídce není, řekni to a nabídni podobný z nabídky. Nic nepřidávej bez souhlasu.
- Jakmile znáš produkty, množství, den vyzvednutí a jméno, zavolej prepare_order (den jako datum YYYY-MM-DD).
  Teprve z výsledku prepare_order zákazníkovi objednávku i celkovou cenu zopakuj (ceny sám nepočítej) a zeptej se, jestli souhlasí.
- Teprve když zákazník výslovně souhlasí, zavolej confirm_order. Když chce něco změnit, zavolej znovu prepare_order.
- Chybí-li jméno nebo den, zeptej se na ně.
- Když zákazník chce mluvit s člověkem, zavolej request_callback.
- Když ani na druhý pokus nerozumíš, co zákazník chce, nabídni, že mu zavolá kolega, a při souhlasu zavolej request_callback.`;

// JSON Schema tool definitions, provider-neutral.
export const TOOLS = [
  {
    name: "list_products",
    description: "Vrátí nabídku pekárny: id, název, cena v Kč.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "prepare_order",
    // ADR-0010: "when not to call" in the description, catalogue IDs as an enum in the schema.
    description:
      "Připraví objednávku k potvrzení a vrátí shrnutí s celkovou cenou. Ještě ji neukládá. " +
      "Nevolej, dokud zákazník jasně neřekl každý produkt. Když slovo neodpovídá žádnému produktu " +
      "z nabídky nebo mu nerozumíš, produkt nedomýšlej a zeptej se.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              product_id: { type: "string", enum: CATALOGUE.map((p) => p.id) },
              quantity: { type: "integer", minimum: 1 },
            },
            required: ["product_id", "quantity"],
          },
        },
        pickup_date: { type: "string", description: "YYYY-MM-DD" },
        customer_name: { type: "string" },
      },
      required: ["items", "pickup_date", "customer_name"],
    },
  },
  {
    name: "confirm_order",
    description: "Uloží naposledy připravenou objednávku. Volat jen po výslovném souhlasu zákazníka.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "request_callback",
    description: "Zaznamená žádost, aby zákazníkovi zavolal člověk z pekárny.",
    parameters: {
      type: "object",
      properties: {
        customer_name: { type: "string" },
        note: { type: "string" },
      },
      required: ["note"],
    },
  },
];

// The tool side the harness plays. Unknown ids are refused, like the real server would.
export function runTool(name, args) {
  if (name === "list_products") return { products: CATALOGUE };
  if (name === "prepare_order") {
    const lines = [];
    for (const it of args.items ?? []) {
      const p = CATALOGUE.find((c) => c.id === it.product_id);
      if (!p) return { error: `unknown product_id ${it.product_id}` };
      lines.push({ name: p.name, quantity: it.quantity, subtotal: p.price * it.quantity });
    }
    const total = lines.reduce((s, l) => s + l.subtotal, 0);
    return { ok: true, lines, total_czk: total, pickup_date: args.pickup_date };
  }
  if (name === "confirm_order") return { ok: true, order_id: "R-1001" };
  if (name === "request_callback") return { ok: true };
  return { error: `unknown tool ${name}` };
}

export function loadUtterances() {
  return JSON.parse(readFileSync(new URL("./utterances.json", import.meta.url), "utf8"));
}

// Pass/fail per utterance from the tool calls the provider made.
export function score(u, calls) {
  const prep = calls.filter((c) => c.name === "prepare_order").at(-1);
  const cb = calls.some((c) => c.name === "request_callback");
  const e = u.expect;
  if (e.callback) return { pass: cb, why: cb ? "callback requested" : "no request_callback" };
  if (e.noOrder) {
    const bad = prep && JSON.stringify(prep.args).includes("bage");
    return { pass: !bad, why: bad ? "invented a product" : "no invented product" };
  }
  if (!prep) return { pass: false, why: "no prepare_order call" };
  const got = Object.fromEntries((prep.args.items ?? []).map((i) => [i.product_id, i.quantity]));
  const itemsOk =
    Object.keys(got).length === Object.keys(e.items).length &&
    Object.entries(e.items).every(([k, v]) => got[k] === v);
  const dateOk = prep.args.pickup_date === e.date;
  const nameOk = (prep.args.customer_name ?? "").toLowerCase().includes(e.name.toLowerCase().slice(0, 5));
  const why = [!itemsOk && `items ${JSON.stringify(got)}`, !dateOk && `date ${prep.args.pickup_date}`, !nameOk && `name ${prep.args.customer_name}`]
    .filter(Boolean)
    .join("; ");
  return { pass: itemsOk && dateOk && nameOk, why: why || "ok" };
}

export function saveResults(provider, variant, rows) {
  mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
  writeFileSync(new URL(`./out/${provider}-${variant}.json`, import.meta.url), JSON.stringify(rows, null, 2));
  const lat = rows.map((r) => r.latencyMs).filter((x) => x != null).sort((a, b) => a - b);
  const pct = (p) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(p * lat.length))] : null);
  const passed = rows.filter((r) => r.pass).length;
  console.log(`\n${provider} / ${variant}: ${passed}/${rows.length} pass, first audio median ${pct(0.5)} ms, max ${lat.at(-1)} ms`);
  for (const r of rows) console.log(`  ${r.pass ? "PASS" : "FAIL"} ${r.id} ${r.latencyMs ?? "-"} ms  ${r.why}`);
}

export function pcm16ToWav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
