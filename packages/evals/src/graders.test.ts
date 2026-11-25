import { describe, expect, it } from "vitest";
import { loadCustomerCases, type CustomerCase, type StaffCase } from "./cases.ts";
import {
  type CustomerRun,
  gradeCatalogueAndCalendar,
  gradeConsent,
  gradeDictation,
  gradeOutcome,
  gradeTurns,
} from "./graders.ts";

const dialogue: CustomerCase = {
  id: "d01",
  covers: "test",
  gate: true,
  turns: [
    { say: "Dva rohlíky na zítra.", mustNotCall: ["prepare_order"], sayAny: ["jmén"] },
    { say: "Novák.", mustCall: "prepare_order", order: { items: { rohlik: 2 }, date: "2026-11-25" }, sayAny: ["8"] },
    { say: "Ano.", consent: true, mustCall: "confirm_order" },
  ],
  final: { saved: { items: { rohlik: 2 }, date: "2026-11-25", name: "Novák" } },
};
const prepare = {
  name: "prepare_order",
  args: { items: [{ product_id: "rohlik", quantity: 2 }], pickup_date: "2026-11-25", customer_name: "Novák" },
  result: { ok: true, draft_id: "d", total_czk: 8 },
};
const confirm = { name: "confirm_order", args: { draft_id: "d" }, result: { ok: true, order_number: 1001 } };
const good: CustomerRun = {
  turns: [
    { say: "", calls: [], reply: "Na jaké jméno?" },
    { say: "", calls: [prepare], reply: "Dva rohlíky, celkem 8 Kč. Souhlasí?" },
    { say: "", calls: [confirm], reply: "Číslo objednávky 1001." },
  ],
  saved: [{ items: { rohlik: 2 }, date: "2026-11-25", name: "Novák" }],
  requests: [],
};

describe("customer graders", () => {
  it("pass the conversation that does everything right", () => {
    expect(gradeTurns(dialogue, good).pass).toBe(true);
    expect(gradeConsent(dialogue, good).pass).toBe(true);
    expect(gradeCatalogueAndCalendar(good, ["2026-11-25"]).pass).toBe(true);
    expect(gradeOutcome(dialogue, good).pass).toBe(true);
  });

  it("fail an order prepared before the name was given", () => {
    const early = { ...good, turns: [{ say: "", calls: [prepare], reply: "Na jaké jméno?" }, ...good.turns.slice(1)] };
    expect(gradeTurns(dialogue, early)).toEqual({ pass: false, why: "turn 1: called prepare_order" });
  });

  it("fail a wrong day and a read-back without the total", () => {
    const wrongDay = { ...prepare, args: { ...prepare.args, pickup_date: "2026-11-26" } };
    const run = {
      ...good,
      turns: [good.turns[0]!, { say: "", calls: [wrongDay], reply: "Souhlasí?" }, good.turns[2]!],
    };
    expect(gradeTurns(dialogue, run).why).toBe("turn 2: date 2026-11-26");
    const noTotal = {
      ...good,
      turns: [good.turns[0]!, { say: "", calls: [prepare], reply: "Souhlasí?" }, good.turns[2]!],
    };
    expect(gradeTurns(dialogue, noTotal).why).toContain("reply lacks");
  });

  it("fail a save without a yes, even when the order is right", () => {
    const eager = {
      ...good,
      turns: [
        good.turns[0]!,
        { say: "", calls: [prepare, confirm], reply: "Uloženo." },
        { say: "", calls: [], reply: "" },
      ],
    };
    expect(gradeConsent(dialogue, eager)).toEqual({ pass: false, why: "confirm_order in turn 2 without a yes" });
  });

  it("fail a product the server refused and a day outside the calendar", () => {
    const refused = {
      ...good,
      turns: [
        {
          say: "",
          calls: [{ ...prepare, result: { ok: false, reason: "invalid_arguments", detail: "items.0.product_id" } }],
          reply: "",
        },
      ],
    };
    expect(gradeCatalogueAndCalendar(refused, ["2026-11-25"]).pass).toBe(false);
    expect(gradeCatalogueAndCalendar(good, ["2026-11-24"]).why).toBe("date 2026-11-25 is not in the calendar");
  });

  it("check the database: exactly the expected order, and nothing when none is expected", () => {
    expect(gradeOutcome(dialogue, { ...good, saved: [...good.saved, ...good.saved] }).why).toBe("2 orders saved");
    expect(gradeOutcome({ ...dialogue, final: undefined }, good).pass).toBe(false);
    expect(
      gradeOutcome({ ...dialogue, final: { request: "callback" } }, { ...good, saved: [], requests: ["callback"] })
        .pass,
    ).toBe(true);
  });
});

describe("staff dictation grader", () => {
  const c: StaffCase = {
    id: "s03",
    covers: "test",
    say: "",
    expect: { name: "Nováková", date: "2026-11-25", items: { "chleb-kminovy": 2 }, unmatched: ["raz"] },
  };
  const got = {
    customerName: "Nováková",
    pickupDate: "2026-11-25",
    items: [{ productId: "chleb-kminovy", quantity: 2 }],
    unmatched: [{ word: "razowy", quantity: 1, candidateIds: ["chleb-zitny"] }],
  };

  it("passes an unknown word left in unmatched", () => {
    expect(gradeDictation(c, got).pass).toBe(true);
  });

  it("fails an unknown word guessed into the order", () => {
    const guessed = { ...got, items: [...got.items, { productId: "chleb-zitny", quantity: 1 }], unmatched: [] };
    expect(gradeDictation(c, guessed).pass).toBe(false);
  });

  it("fails a name that was not said", () => {
    expect(gradeDictation({ ...c, expect: { ...c.expect, name: null } }, got).why).toBe("name Nováková");
  });
});

describe("d01 asks for the name in other words (research R45)", () => {
  const d01 = loadCustomerCases().cases.find((c) => c.id === "d01-missing-name");
  // The first turn of the trial that failed in eval gate run #8 (a9761bc), as stored in its artifact.
  const askedForWhom: CustomerRun = {
    turns: [
      {
        say: "Dobrý den, dva rohlíky na zítra.",
        calls: [],
        reply:
          "Zítra máme zavřeno. Počkejte, zítra je středa – zítra máme otevřeno. Jen neděle jsou zavřené. \nMáte na mysli zítřek, tedy středu 25. listopadu? A pro koho prosím rezervaci připravím?",
      },
      good.turns[1]!,
      good.turns[2]!,
    ],
    saved: good.saved,
    requests: [],
  };

  it("'pro koho' counts as asking for the name", () => {
    expect(gradeTurns(d01!, askedForWhom).pass).toBe(true);
  });

  it("a reply that asks for nothing still fails", () => {
    const silent = {
      ...askedForWhom,
      turns: [{ ...askedForWhom.turns[0]!, reply: "Dobře, zítra je středa." }, ...askedForWhom.turns.slice(1)],
    };
    expect(gradeTurns(d01!, silent)).toEqual({ pass: false, why: "turn 1: reply lacks any of jmén/jmenuj/pro koho" });
  });
});
