import "server-only";
import { CLOSED_REQUEST_RETENTION_DAYS, pragueDate } from "@bakery/core";
import { applyRetention } from "@bakery/db";
import { CALL_START_LIMIT } from "./call-session";
import { WEB_ORDER_LIMIT, WEB_PREVIEW_LIMIT } from "./customer/orders";
import { log } from "./log";
import { db } from "./runtime";

/** Transcripts are kept 30 days (ADR-0008, FR-009). */
export const TRANSCRIPT_RETENTION_DAYS = 30;
/** Notifications are kept 30 days (spec 002 FR-016). */
export const NOTIFICATION_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A counter older than the longest limit window can no longer limit anything. */
const LONGEST_RATE_WINDOW_MS = Math.max(
  CALL_START_LIMIT.windowMs,
  WEB_ORDER_LIMIT.windowMs,
  WEB_PREVIEW_LIMIT.windowMs,
);

/** The nightly clean-up: transcripts past retention, expired drafts, spent rate-limit counters, old notifications, closed requests after 30 days. */
export async function runRetention(now = new Date()) {
  const keepFrom = new Date(now.getTime() - TRANSCRIPT_RETENTION_DAYS * DAY_MS);
  const deleted = await applyRetention(db(), {
    pickupDayBefore: pragueDate(keepFrom),
    callStartedBefore: keepFrom,
    draftExpiredBefore: now,
    rateWindowBefore: new Date(now.getTime() - LONGEST_RATE_WINDOW_MS),
    notificationCreatedBefore: new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * DAY_MS),
    requestClosedBefore: new Date(now.getTime() - CLOSED_REQUEST_RETENTION_DAYS * DAY_MS),
  });
  log.info(deleted, "retention applied");
  return deleted;
}
