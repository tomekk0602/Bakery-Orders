import type { StaffOrder } from "@bakery/core/contracts";

const DAY = new Intl.DateTimeFormat("cs-CZ", { weekday: "long", day: "numeric", month: "numeric", timeZone: "UTC" });

/** "úterý 24. 11." for a YYYY-MM-DD day (noon UTC is the same calendar day in Prague). */
export const formatDay = (day: string): string => DAY.format(new Date(`${day}T12:00:00Z`));

export const formatCzk = (amount: number): string => `${amount.toLocaleString("cs-CZ")} Kč`;

/** "2× Kmínový chléb, 6× Rohlík" */
export const itemsSummary = (order: Pick<StaffOrder, "lines">): string =>
  order.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ");
