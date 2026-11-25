import { z } from "zod";
import { StaffOrder, TranscriptTurn } from "./orders.ts";

export const RequestKind = z.enum(["callback", "change", "cancel"]);
export const RequestOrigin = z.enum(["agent", "promised_not_recorded", "web"]);
/** How a request ended (FR-047, amended 2026-11-25). */
export const RequestOutcome = z.enum(["handled", "unreachable"]);
export type RequestOutcome = z.infer<typeof RequestOutcome>;
export const RequestStep = z.enum([
  "call_started",
  "unanswered",
  "handled",
  "unreachable",
  "reopened",
  "order_cancelled",
]);

/** One step in a request's history, oldest first (FR-051). */
export const RequestHistoryEntry = z.object({
  kind: RequestStep,
  /** the staff member's name; null when the account was removed */
  by: z.string().nullable(),
  at: z.iso.datetime(),
  note: z.string().nullable(),
  orderNumber: z.number().int().nullable(),
});
export type RequestHistoryEntry = z.infer<typeof RequestHistoryEntry>;

/** An upcoming order of the request's phone number, for cancel and change requests (FR-052). */
export const RequestOrder = StaffOrder.pick({ id: true, number: true, pickupDay: true, totalCzk: true, lines: true });
export type RequestOrder = z.infer<typeof RequestOrder>;

export const StaffRequestItem = z.object({
  id: z.uuid(),
  kind: RequestKind,
  origin: RequestOrigin,
  customerName: z.string().nullable(),
  customerPhone: z.string().nullable(),
  note: z.string(),
  createdAt: z.iso.datetime(),
  doneAt: z.iso.datetime().nullable(),
  /** what was said on the call the request came from (FR-012) */
  transcript: z.array(TranscriptTurn).nullable(),
  outcome: RequestOutcome.nullable(),
  /** "Volá <name>" while a started call lasts (FR-050) */
  callingNow: z.object({ name: z.string() }).nullable(),
  /** unanswered calls so far (FR-048) */
  attempts: z.number().int().nonnegative(),
  /** enough unanswered calls to close it as unreachable (FR-049) */
  canCloseUnreachable: z.boolean(),
  history: z.array(RequestHistoryEntry),
  orders: z.array(RequestOrder),
});
export type StaffRequestItem = z.infer<typeof StaffRequestItem>;

/**
 * GET /api/staff/requests — open requests oldest first, and those closed today (FR-008, FR-034, FR-041,
 * FR-053; amended 2026-11-25: was the latest 20 handled).
 */
export const StaffRequestsResponse = z.object({
  open: z.array(StaffRequestItem),
  closedToday: z.array(StaffRequestItem),
});
export type StaffRequestsResponse = z.infer<typeof StaffRequestsResponse>;

/** PATCH /api/staff/requests/:id — one step on a request (FR-047–FR-051; replaces `{ done }`). */
export const RequestAction = z.enum(["call", "unanswered", "handled", "unreachable", "reopen"]);
export type RequestAction = z.infer<typeof RequestAction>;
export const RequestActionBody = z.object({
  action: RequestAction,
  note: z.string().trim().max(300).optional(),
});
export type RequestActionBody = z.infer<typeof RequestActionBody>;

/** POST /api/staff/requests/:id/cancel-order — cancel the order and close the request (FR-052). */
export const CancelFromRequestBody = z.object({ orderId: z.uuid() });
export const CancelFromRequestResult = z.object({ ok: z.literal(true), orderNumber: z.number().int() });

/** GET /api/staff/requests/archive — closed before today, newest closed first; owner only (FR-054, FR-055). */
export const RequestArchiveQuery = z.object({
  outcome: RequestOutcome.optional(),
  q: z.string().trim().max(80).optional(),
  cursor: z.string().max(200).optional(),
});
export type RequestArchiveQuery = z.infer<typeof RequestArchiveQuery>;
export const RequestArchivePage = z.object({ items: z.array(StaffRequestItem), nextCursor: z.string().nullable() });
export type RequestArchivePage = z.infer<typeof RequestArchivePage>;
