import { createHash } from "node:crypto";
import { buildCalendar, type BakerySchedule } from "../calendar.ts";
import type { Product } from "../catalogue.ts";
import { buildInstructions } from "./prompt.ts";
import { buildToolSchemas, toolDeclarations } from "./tools.ts";
import { buildVocabulary } from "./vocabulary.ts";

/** A fixed bakery and day, so the fingerprint depends only on the agent definition. */
const FIXTURE_CATALOGUE: Product[] = [
  { id: "chleb-kminovy", name: "Kmínový chléb", spokenForms: ["kmínové chleby"], priceCzk: 69, dailyLimit: 30, active: true },
  { id: "kaiserka", name: "Kaiserka", spokenForms: ["kaiserky", "kaiserek"], priceCzk: 7, dailyLimit: null, active: true },
  { id: "vanocka", name: "Vánočka", spokenForms: ["vánočky"], priceCzk: 120, dailyLimit: null, active: false },
];
const FIXTURE_SCHEDULE: BakerySchedule = { closedWeekdays: [7], closedDays: [], cutoffDaysBefore: 1, cutoffTime: "14:00" };
const FIXTURE_NOW = new Date("2026-11-24T09:00:00Z");

/** Hash of what the model receives for the fixture — instructions, tools and vocabulary. */
export function agentFingerprint(): string {
  const calendar = buildCalendar(FIXTURE_NOW, FIXTURE_SCHEDULE);
  const schemas = buildToolSchemas(FIXTURE_CATALOGUE);
  const payload = JSON.stringify({
    customer: buildInstructions({ mode: "customer", bakeryName: "Pekárna U Lípy", calendar, catalogue: FIXTURE_CATALOGUE }),
    staff: buildInstructions({ mode: "staff", bakeryName: "Pekárna U Lípy", calendar, catalogue: FIXTURE_CATALOGUE }),
    tools: [toolDeclarations(schemas, "customer"), toolDeclarations(schemas, "staff")],
    vocabulary: buildVocabulary(FIXTURE_CATALOGUE, "Pekárna U Lípy"),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}
