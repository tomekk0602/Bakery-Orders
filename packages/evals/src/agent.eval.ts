import { evalite } from "evalite";
import { afterAll } from "vitest";
import { calendarDates, runConversation, runDictation } from "./agents.ts";
import { type CustomerCase, loadCustomerCases, loadStaffCases, type StaffCase } from "./cases.ts";
import { startEvalDb } from "./eval-db.ts";
import { selectionFrom } from "./gate.ts";
import {
  type CustomerRun,
  type Grade,
  gradeCatalogueAndCalendar,
  gradeConsent,
  gradeDictation,
  gradeOutcome,
  gradeTurns,
} from "./graders.ts";

// Both suites live in one file so they share one process, one database and one request pacer.
const env = await startEvalDb();
afterAll(() => env.stop());

/** EVAL_CASES narrows the run: "gate" for the gate cases, or a comma-separated list of ids. */
const selection = selectionFrom(process.env.EVAL_CASES);
const selected = (id: string, gate: boolean) =>
  selection === "all" ? true : selection === "gate" ? gate : selection.includes(id);

const score = (g: Grade) => ({ score: g.pass ? 1 : 0, metadata: g.why });
const dates = calendarDates(env);

evalite<CustomerCase, CustomerRun>("customer", {
  data: loadCustomerCases()
    .cases.filter((c) => selected(c.id, c.gate))
    .map((c) => ({ input: c })),
  task: (c) => runConversation(c, env),
  scorers: [
    {
      name: "turns",
      description: "tools, order and read-back in each turn",
      scorer: ({ input, output }) => score(gradeTurns(input, output)),
    },
    {
      name: "consent",
      description: "confirm_order only after a yes",
      scorer: ({ input, output }) => score(gradeConsent(input, output)),
    },
    {
      name: "catalogue+calendar",
      description: "products from the offer, days from the calendar",
      scorer: ({ output }) => score(gradeCatalogueAndCalendar(output, dates)),
    },
    {
      name: "database",
      description: "what was saved and requested",
      scorer: ({ input, output }) => score(gradeOutcome(input, output)),
    },
  ],
  columns: ({ input, output }) => [
    { label: "case", value: input.id },
    {
      label: "conversation",
      value: output.turns
        .map(
          (t) =>
            `> ${t.say}\n${t.calls.map((c) => `  [${c.name} ${JSON.stringify(c.args)} → ${JSON.stringify(c.result)}]`).join("\n")}\n< ${t.reply}`,
        )
        .join("\n"),
    },
  ],
});

evalite<StaffCase, Awaited<ReturnType<typeof runDictation>>>("staff", {
  data: loadStaffCases()
    .cases.filter((c) => selected(c.id, true))
    .map((c) => ({ input: c })),
  task: (c) => runDictation(c.say, env),
  scorers: [
    {
      name: "dictation",
      description: "fields, and unknown words left unmatched",
      scorer: ({ input, output }) =>
        score(
          "invalid" in output
            ? { pass: false, why: `invalid output: ${output.invalid}` }
            : gradeDictation(input, output),
        ),
    },
  ],
  columns: ({ input, output }) => [
    { label: "case", value: input.id },
    { label: "extraction", value: JSON.stringify(output) },
  ],
});
