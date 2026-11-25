import {
  ARCHIVE_PAGE,
  CALL_CLAIM_MS,
  phoneKey,
  pragueDate,
  pragueDayStart,
  subjectOf,
  UNREACHABLE_AFTER_ATTEMPTS,
} from "@bakery/core";
import type {
  RequestAction,
  RequestHistoryEntry,
  RequestOrder,
  StaffRequestItem,
  TranscriptTurn,
} from "@bakery/core/contracts";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lt, type SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { user } from "./auth-schema.ts";
import type { Db } from "./client.ts";
import { readBySubject } from "./notifications.repo.ts";
import { call, order, staffRequest, staffRequestEvent } from "./schema.ts";
import { cancelOrderIn, confirmedOrdersForPhone } from "./staff-orders.repo.ts";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const claimer = alias(user, "claimer");

const columns = {
  id: staffRequest.id,
  kind: staffRequest.kind,
  origin: staffRequest.origin,
  customerName: staffRequest.customerName,
  customerPhone: staffRequest.customerPhone,
  note: staffRequest.note,
  createdAt: staffRequest.createdAt,
  doneAt: staffRequest.doneAt,
  outcome: staffRequest.outcome,
  claimedUntil: staffRequest.claimedUntil,
  claimerName: claimer.name,
  transcript: call.transcript,
};

/** Each request's steps, oldest first, with who did them and the order a cancel concerned (FR-051). */
async function historyOf(db: Db, ids: string[]): Promise<Map<string, RequestHistoryEntry[]>> {
  const byRequest = new Map<string, RequestHistoryEntry[]>();
  if (ids.length === 0) return byRequest;
  const rows = await db
    .select({
      requestId: staffRequestEvent.requestId,
      kind: staffRequestEvent.kind,
      by: user.name,
      at: staffRequestEvent.at,
      note: staffRequestEvent.note,
      orderNumber: order.number,
    })
    .from(staffRequestEvent)
    .leftJoin(user, eq(user.id, staffRequestEvent.userId))
    .leftJoin(order, eq(order.id, staffRequestEvent.orderId))
    .where(inArray(staffRequestEvent.requestId, ids))
    .orderBy(asc(staffRequestEvent.at));
  for (const { requestId, at, ...r } of rows) {
    const list = byRequest.get(requestId) ?? [];
    list.push({ ...r, by: r.by ?? null, orderNumber: r.orderNumber ?? null, at: at.toISOString() });
    byRequest.set(requestId, list);
  }
  return byRequest;
}

/** The orders a cancel or change request may be about: its number's confirmed ones from today (FR-052). */
async function ordersFor(
  db: Db | Tx,
  r: { kind: string; customerPhone: string | null },
  now: Date,
): Promise<RequestOrder[]> {
  const key = phoneKey(r.customerPhone);
  if (r.kind === "callback" || !key) return [];
  const orders = await confirmedOrdersForPhone(db, key, pragueDate(now));
  return orders.map(({ id, number, pickupDay, totalCzk, lines }) => ({ id, number, pickupDay, totalCzk, lines }));
}

const selectRequests = (db: Db) =>
  db
    .select(columns)
    .from(staffRequest)
    .leftJoin(call, eq(call.id, staffRequest.callId))
    .leftJoin(claimer, eq(claimer.id, staffRequest.claimedBy));
type RequestRow = Awaited<ReturnType<ReturnType<typeof selectRequests>["where"]>>[number];

/** Rows as the app shows them: who is calling now, attempts, history, the customer's orders. */
async function toItems(db: Db, rows: RequestRow[], now: Date): Promise<StaffRequestItem[]> {
  const history = await historyOf(
    db,
    rows.map((r) => r.id),
  );
  return Promise.all(
    rows.map(async (r) => {
      const steps = history.get(r.id) ?? [];
      const attempts = steps.filter((s) => s.kind === "unanswered").length;
      const calling = r.doneAt === null && r.claimedUntil !== null && r.claimedUntil > now && r.claimerName;
      return {
        id: r.id,
        kind: r.kind,
        origin: r.origin,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
        doneAt: r.doneAt?.toISOString() ?? null,
        transcript: (r.transcript as TranscriptTurn[] | null) ?? null,
        outcome: r.outcome,
        callingNow: calling ? { name: calling } : null,
        attempts,
        canCloseUnreachable: r.doneAt === null && attempts >= UNREACHABLE_AFTER_ATTEMPTS,
        history: steps,
        orders: r.doneAt === null ? await ordersFor(db, r, now) : [],
      };
    }),
  );
}

/**
 * The work list (FR-053): open requests, oldest first (they have waited longest), and those closed
 * today in Prague, latest first. Everything closed earlier is in the owner's archive.
 */
export async function listStaffRequests(
  db: Db,
  now = new Date(),
): Promise<{ open: StaffRequestItem[]; closedToday: StaffRequestItem[] }> {
  const open = await selectRequests(db).where(isNull(staffRequest.doneAt)).orderBy(asc(staffRequest.createdAt));
  const closedToday = await selectRequests(db)
    .where(gte(staffRequest.doneAt, pragueDayStart(now)))
    .orderBy(desc(staffRequest.doneAt));
  return { open: await toItems(db, open, now), closedToday: await toItems(db, closedToday, now) };
}

/** The archive's cursor: the last item's closing time and id, so a page never repeats or skips one. */
const encodeCursor = (r: { doneAt: Date | null; id: string }) => `${r.doneAt?.toISOString()}|${r.id}`;
function decodeCursor(cursor: string | undefined): { doneAt: Date; id: string } | null {
  const [at, id] = (cursor ?? "").split("|");
  const doneAt = new Date(at ?? "");
  return id && !Number.isNaN(doneAt.getTime()) ? { doneAt, id } : null;
}

/** At least this many digits make a search a phone number search (FR-055). */
const PHONE_SEARCH_DIGITS = 3;

/**
 * One page of the owner's archive (FR-054, FR-055): requests closed before today, newest closed first,
 * by keyset on (done_at, id); filtered by outcome; searched by name or, with digits, by phone number.
 */
export async function archivePage(
  db: Db,
  v: { outcome?: "handled" | "unreachable"; q?: string; cursor?: string; now?: Date },
): Promise<{ items: StaffRequestItem[]; nextCursor: string | null }> {
  const now = v.now ?? new Date();
  const after = decodeCursor(v.cursor);
  const q = v.q?.trim() ?? "";
  const digits = q.replace(/\D/g, "");
  const conditions: SQL[] = [lt(staffRequest.doneAt, pragueDayStart(now))];
  if (v.outcome) conditions.push(eq(staffRequest.outcome, v.outcome));
  if (digits.length >= PHONE_SEARCH_DIGITS)
    conditions.push(
      sql`regexp_replace(coalesce(${staffRequest.customerPhone}, ''), '[^0-9]', '', 'g') like ${`%${digits}%`}`,
    );
  else if (q) conditions.push(ilike(staffRequest.customerName, `%${q}%`));
  if (after) conditions.push(sql`(${staffRequest.doneAt}, ${staffRequest.id}) < (${after.doneAt}, ${after.id})`);
  const rows = await selectRequests(db)
    .where(and(...conditions))
    .orderBy(desc(staffRequest.doneAt), desc(staffRequest.id))
    .limit(ARCHIVE_PAGE + 1);
  const page = rows.slice(0, ARCHIVE_PAGE);
  const last = page.at(-1);
  return {
    items: await toItems(db, page, now),
    nextCursor: rows.length > ARCHIVE_PAGE && last ? encodeCursor(last) : null,
  };
}

export type RequestActionResult =
  { ok: true } | { ok: false; reason: "not_found" | "no_phone" | "too_early" | "closed" | "open" };

const STEP = {
  call: "call_started",
  unanswered: "unanswered",
  handled: "handled",
  unreachable: "unreachable",
  reopen: "reopened",
} as const;

/**
 * One step on a request (spec 001 FR-047–FR-051): a call started ("Volá …" for five minutes), an
 * unanswered call, handled or unreachable (both close it and read its notifications for everyone, spec
 * 002 FR-003), or reopening. Each step is recorded with who did it.
 */
export async function actOnRequest(
  db: Db,
  v: { id: string; userId: string; action: RequestAction; note?: string; now?: Date },
): Promise<RequestActionResult> {
  const now = v.now ?? new Date();
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(staffRequest).where(eq(staffRequest.id, v.id)).for("update");
    if (!r) return { ok: false, reason: "not_found" } as const;
    const isOpen = r.doneAt === null;
    if (v.action === "reopen" ? isOpen : !isOpen) return { ok: false, reason: isOpen ? "open" : "closed" } as const;
    if ((v.action === "call" || v.action === "unanswered") && !phoneKey(r.customerPhone))
      return { ok: false, reason: "no_phone" } as const;
    if (v.action === "unreachable") {
      const [tried] = await tx
        .select({ n: count() })
        .from(staffRequestEvent)
        .where(and(eq(staffRequestEvent.requestId, r.id), eq(staffRequestEvent.kind, "unanswered")));
      if ((tried?.n ?? 0) < UNREACHABLE_AFTER_ATTEMPTS) return { ok: false, reason: "too_early" } as const;
    }

    const noClaim = { claimedBy: null, claimedUntil: null };
    const change =
      v.action === "call"
        ? { claimedBy: v.userId, claimedUntil: new Date(now.getTime() + CALL_CLAIM_MS) }
        : v.action === "unanswered"
          ? noClaim
          : v.action === "reopen"
            ? { ...noClaim, doneAt: null, outcome: null }
            : { ...noClaim, doneAt: now, outcome: v.action };
    await tx.update(staffRequest).set(change).where(eq(staffRequest.id, r.id));
    const closing = v.action === "handled" || v.action === "unreachable";
    await tx.insert(staffRequestEvent).values({
      requestId: r.id,
      userId: v.userId,
      kind: STEP[v.action],
      note: closing ? v.note || null : null,
      at: now,
    });
    if (closing) await readBySubject(tx, subjectOf.request(r.id), now);
    return { ok: true } as const;
  });
}

export type CancelFromRequestResult =
  | { ok: true; orderNumber: number }
  | { ok: false; reason: "not_found" | "closed" | "not_cancel" | "cancelled" | "picked_up" };

/**
 * Cancels one of a cancellation request's orders and closes the request as handled, in one transaction:
 * either both happen or neither (spec 001 FR-052, SC-014). Only an order the request lists can be
 * cancelled this way.
 */
export async function cancelOrderFromRequest(
  db: Db,
  v: { requestId: string; orderId: string; userId: string; now?: Date },
): Promise<CancelFromRequestResult> {
  const now = v.now ?? new Date();
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(staffRequest).where(eq(staffRequest.id, v.requestId)).for("update");
    if (!r) return { ok: false, reason: "not_found" } as const;
    if (r.doneAt !== null) return { ok: false, reason: "closed" } as const;
    if (r.kind !== "cancel") return { ok: false, reason: "not_cancel" } as const;
    const target = (await ordersFor(tx, r, now)).find((o) => o.id === v.orderId);
    if (!target) return { ok: false, reason: "not_found" } as const;

    const cancelled = await cancelOrderIn(tx, target.id, now);
    if (!cancelled.ok) return cancelled;
    await tx
      .update(staffRequest)
      .set({ doneAt: now, outcome: "handled", claimedBy: null, claimedUntil: null })
      .where(eq(staffRequest.id, r.id));
    await tx.insert(staffRequestEvent).values({
      requestId: r.id,
      userId: v.userId,
      kind: "order_cancelled",
      orderId: target.id,
      at: now,
    });
    await readBySubject(tx, subjectOf.request(r.id), now);
    return { ok: true, orderNumber: target.number } as const;
  });
}
