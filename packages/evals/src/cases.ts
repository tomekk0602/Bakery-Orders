import { readFileSync } from "node:fs";
import { z } from "zod";

const Items = z.record(z.string(), z.number().int().min(1));
const Order = z.object({ items: Items, date: z.string(), name: z.string().optional() });

/** One customer turn and what the agent must and must not do in reply to it. */
const CustomerTurn = z.object({
  say: z.string().min(1),
  /** This turn is the customer's explicit yes; `confirm_order` is allowed only here. */
  consent: z.boolean().optional(),
  mustCall: z.string().optional(),
  mustNotCall: z.array(z.string()).optional(),
  mustNotCallDate: z.string().optional(),
  order: Order.optional(),
  sayAny: z.array(z.string()).optional(),
  callOrSay: z.object({ call: z.string(), sayAny: z.array(z.string()) }).optional(),
});

export const CustomerCase = z.object({
  id: z.string(),
  covers: z.string(),
  /** The case ends in an order: it must pass in every trial (ADR-0012: pass^k), and it runs in the CI gate. */
  gate: z.boolean(),
  turns: z.array(CustomerTurn).min(1),
  final: z
    .object({
      saved: Order.extend({ name: z.string() }).optional(),
      request: z.enum(["callback", "change", "cancel"]).optional(),
    })
    .optional(),
});
export type CustomerCase = z.infer<typeof CustomerCase>;
export type CustomerTurn = z.infer<typeof CustomerTurn>;

export const StaffCase = z.object({
  id: z.string(),
  covers: z.string(),
  say: z.string().min(1),
  expect: z.object({
    name: z.string().nullable(),
    date: z.string().nullable(),
    items: Items,
    /** A fragment of each word that must land in `unmatched`, never in `items`. */
    unmatched: z.array(z.string()),
  }),
});
export type StaffCase = z.infer<typeof StaffCase>;

const file = <T extends z.ZodType>(name: string, item: T) =>
  z
    .object({ today: z.iso.date(), cases: z.array(item) })
    .parse(JSON.parse(readFileSync(new URL(`../cases/${name}`, import.meta.url), "utf8")));

export const loadCustomerCases = () => file("customer.json", CustomerCase);
export const loadStaffCases = () => file("staff.json", StaffCase);
