import { TZDate } from "@date-fns/tz";
import { addDays, format, getISODay, subDays } from "date-fns";
import { cs } from "date-fns/locale";
import Holidays from "date-holidays";

export const TIME_ZONE = "Europe/Prague";

/** How far ahead orders are taken and how many days the agent's calendar lists (research R1). */
export const CALENDAR_DAYS = 14;

export type BakerySchedule = {
  /** ISO weekdays, 1 = Monday … 7 = Sunday */
  closedWeekdays: number[];
  /** extra days the owner closes, YYYY-MM-DD */
  closedDays: string[];
  /** orders close this many days before pickup … */
  cutoffDaysBefore: number;
  /** … at this Prague time, "HH:MM" */
  cutoffTime: string;
};

export type CalendarDay = {
  date: string;
  weekday: number;
  weekdayName: string;
  relative: "today" | "tomorrow" | "day_after" | null;
  closed: boolean;
  closedReason: "weekday" | "holiday" | "owner" | null;
};

const holidays = new Holidays("CZ", { types: ["public"] });
const RELATIVE = ["today", "tomorrow", "day_after"] as const;

/** The calendar day in Prague for an instant. */
export function pragueDate(now: Date): string {
  return format(new TZDate(now, TIME_ZONE), "yyyy-MM-dd");
}

function isPublicHoliday(date: string): boolean {
  // Noon UTC is the same calendar day in Prague in winter and summer.
  const hits = holidays.isHoliday(new Date(`${date}T12:00:00Z`));
  return Array.isArray(hits) && hits.some((h) => h.type === "public");
}

function pragueNoon(date: string): TZDate {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new TZDate(y, m - 1, d, 12, 0, 0, TIME_ZONE);
}

export function describeDay(date: string, schedule: BakerySchedule, relative: CalendarDay["relative"] = null): CalendarDay {
  const noon = pragueNoon(date);
  const weekday = getISODay(noon);
  const closedReason = schedule.closedWeekdays.includes(weekday)
    ? "weekday"
    : schedule.closedDays.includes(date)
      ? "owner"
      : isPublicHoliday(date)
        ? "holiday"
        : null;
  return { date, weekday, weekdayName: format(noon, "EEEE", { locale: cs }), relative, closed: closedReason !== null, closedReason };
}

/** The next CALENDAR_DAYS days from today in Prague — the table the agent looks dates up in (R1). */
export function buildCalendar(now: Date, schedule: BakerySchedule, days = CALENDAR_DAYS): CalendarDay[] {
  const today = pragueNoon(pragueDate(now));
  return Array.from({ length: days }, (_, i) =>
    describeDay(format(addDays(today, i), "yyyy-MM-dd"), schedule, RELATIVE[i] ?? null),
  );
}

/** Orders for `pickupDate` close at cutoffTime, cutoffDaysBefore days earlier, in Prague. */
export function isAfterCutoff(pickupDate: string, now: Date, schedule: BakerySchedule): boolean {
  const [hh, mm] = schedule.cutoffTime.split(":").map(Number) as [number, number];
  const pickup = pragueNoon(pickupDate);
  const closeDay = subDays(pickup, schedule.cutoffDaysBefore);
  const deadline = new TZDate(closeDay.getFullYear(), closeDay.getMonth(), closeDay.getDate(), hh, mm, 0, TIME_ZONE);
  return now.getTime() >= deadline.getTime();
}
