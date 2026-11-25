import { TZDate } from "@date-fns/tz";
import { pragueDate, TIME_ZONE } from "./calendar.ts";

/**
 * Working a request through (spec 001 FR-047–FR-052, research R33). The two numbers are the owner's
 * proposals of 2026-11-25, not measured; revisit after use.
 */

/** From this many unanswered calls the card offers closing the request as unreachable (FR-049). */
export const UNREACHABLE_AFTER_ATTEMPTS = 3;

/** How long "Volá <name>" shows after a call starts (FR-050). */
export const CALL_CLAIM_MS = 5 * 60 * 1000;

/** A note on closing a request (FR-051). */
export const REQUEST_NOTE_MAX = 300;

/** Closed requests are kept this long after closing, then deleted (FR-057; owner, 2026-11-25). */
export const CLOSED_REQUEST_RETENTION_DAYS = 30;

/** Archive page size (FR-055). */
export const ARCHIVE_PAGE = 20;

/** Midnight of `now`'s day in the bakery's time zone: "closed today" starts here (FR-053). */
export function pragueDayStart(now: Date): Date {
  const [y, m, d] = pragueDate(now).split("-").map(Number) as [number, number, number];
  return new Date(new TZDate(y, m - 1, d, 0, 0, 0, TIME_ZONE).getTime());
}

/** Czech mobile and landline numbers have nine digits after the country code. */
const NATIONAL_DIGITS = 9;

/**
 * The part of a phone number that identifies it however it is written: "+420 777 123 456",
 * "777123456" and "00420777123456" all give "777123456". Null when there are too few digits.
 */
export function phoneKey(phone: string | null): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= NATIONAL_DIGITS ? digits.slice(-NATIONAL_DIGITS) : null;
}
