import type { BakerySettings } from "@bakery/core/contracts";
import { z } from "zod";

// Numbers are typed into text fields, so the form keeps them as strings and converts on save.
const count = z
  .string()
  .trim()
  .regex(/^\d{1,5}$/, "settings.errors.number");
const price = z
  .string()
  .trim()
  .regex(/^[1-9]\d{0,4}$/, "settings.errors.price");

export const SettingsForm = z.object({
  cutoffDaysBefore: z
    .string()
    .trim()
    .regex(/^[0-3]$/, "settings.errors.cutoffDays"),
  cutoffTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "settings.errors.time"),
  closedWeekdays: z.array(z.number()).max(6, "settings.errors.allClosed"),
  closedDays: z.array(
    z.object({
      day: z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "settings.errors.date"),
      reason: z.string().max(80),
    }),
  ),
  products: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      priceCzk: price,
      dailyLimit: z
        .string()
        .trim()
        .regex(/^(|[1-9]\d{0,4})$/, "settings.errors.limit"),
      active: z.boolean(),
      buffers: z.array(count).length(7),
    }),
  ),
});
export type SettingsForm = z.infer<typeof SettingsForm>;

export const toForm = (s: BakerySettings): SettingsForm => ({
  cutoffDaysBefore: String(s.cutoffDaysBefore),
  cutoffTime: s.cutoffTime,
  closedWeekdays: s.closedWeekdays,
  closedDays: s.closedDays.map((d) => ({ day: d.day, reason: d.reason ?? "" })),
  products: s.products.map((p) => ({
    ...p,
    priceCzk: String(p.priceCzk),
    dailyLimit: p.dailyLimit === null ? "" : String(p.dailyLimit),
    buffers: p.buffers.map(String),
  })),
});

export const toSettings = (f: SettingsForm): BakerySettings => ({
  cutoffDaysBefore: Number(f.cutoffDaysBefore),
  cutoffTime: f.cutoffTime.trim(),
  closedWeekdays: f.closedWeekdays,
  closedDays: f.closedDays.map((d) => ({ day: d.day.trim(), reason: d.reason.trim() || null })),
  products: f.products.map((p) => ({
    ...p,
    priceCzk: Number(p.priceCzk),
    dailyLimit: p.dailyLimit.trim() === "" ? null : Number(p.dailyLimit),
    buffers: p.buffers.map(Number),
  })),
});
