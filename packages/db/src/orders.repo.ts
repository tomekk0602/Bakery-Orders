import {
  checkPickupDay,
  NEAR_LIMIT_SHARE,
  notificationText,
  type OrderChannel,
  type PreparedOrder,
  type RefusalReason,
  subjectOf,
} from "@bakery/core";
import { loadBakery } from "./bakery.repo.ts";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { Db } from "./client.ts";
import { notifyStaff, subjectNotified } from "./notifications.repo.ts";
import { firstRow } from "./rows.ts";
import { dailyCapacity, order, orderDraft, orderLine, product } from "./schema.ts";

/** A prepared order waits this long for confirmation (data-model `order_draft`). */
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/** Who may confirm a draft: the call it was prepared in, or the staff member who prepared it (FR-006, FR-019). */
export type DraftOwner = { callId: string } | { userId: string };

const ownerColumns = (owner: DraftOwner) =>
  "callId" in owner ? { callId: owner.callId, createdBy: null } : { callId: null, createdBy: owner.userId };

const ownedBy = (owner: DraftOwner) =>
  "callId" in owner
    ? eq(orderDraft.callId, owner.callId)
    : and(isNull(orderDraft.callId), eq(orderDraft.createdBy, owner.userId));

export async function saveDraft(
  db: Db,
  prepared: PreparedOrder,
  channel: OrderChannel,
  owner: DraftOwner,
  now = new Date(),
): Promise<string> {
  const rows = await db
    .insert(orderDraft)
    .values({ channel, ...ownerColumns(owner), payload: prepared, expiresAt: new Date(now.getTime() + DRAFT_TTL_MS) })
    .returning({ id: orderDraft.id });
  return firstRow(rows, "order_draft").id;
}

export type ConfirmMeta = { promptVersion: string | null; model: string | null };
export type ConfirmResult =
  | { ok: true; orderNumber: number; orderId: string; notificationIds: string[] }
  | { ok: false; reason: "no_draft" | "over_limit" }
  | {
      ok: false;
      reason: Extract<RefusalReason, "past_day" | "outside_window" | "closed_day" | "after_cutoff">;
      detail?: string;
    };

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type OrderSourceValue = typeof order.$inferInsert.source;

/** Thrown inside the transaction when a daily limit would be exceeded; rolls everything back. */
class OverLimit extends Error {}

/**
 * Inserts an order with its lines and takes the daily capacity with a conditional update, so two
 * concurrent orders can never take the same last pieces (research R14, spec E4).
 */
async function insertOrder(
  tx: Tx,
  p: PreparedOrder,
  source: OrderSourceValue,
  meta: ConfirmMeta & { callId: string | null; createdBy: string | null },
) {
  const taken: { productId: string; name: string; dailyLimit: number; reserved: number }[] = [];
  for (const line of p.lines) {
    const [limit] = await tx
      .select({ dailyLimit: product.dailyLimit, name: product.name })
      .from(product)
      .where(eq(product.id, line.productId));
    await tx
      .insert(dailyCapacity)
      .values({ productId: line.productId, day: p.pickupDate, reserved: 0 })
      .onConflictDoNothing();
    const updated = await tx
      .update(dailyCapacity)
      .set({ reserved: sql`${dailyCapacity.reserved} + ${line.quantity}` })
      .where(
        and(
          eq(dailyCapacity.productId, line.productId),
          eq(dailyCapacity.day, p.pickupDate),
          limit?.dailyLimit == null
            ? sql`true`
            : sql`${dailyCapacity.reserved} + ${line.quantity} <= ${limit.dailyLimit}`,
        ),
      )
      .returning({ reserved: dailyCapacity.reserved });
    const [after] = updated;
    if (!after) throw new OverLimit();
    if (limit?.dailyLimit != null)
      taken.push({ ...line, name: limit.name, dailyLimit: limit.dailyLimit, reserved: after.reserved });
  }
  const saved = firstRow(
    await tx
      .insert(order)
      .values({
        source,
        customerName: p.customerName,
        customerPhone: p.customerPhone,
        pickupDay: p.pickupDate,
        totalCzk: p.totalCzk,
        promptVersion: meta.promptVersion,
        model: meta.model,
        callId: meta.callId,
        createdBy: meta.createdBy,
      })
      .returning({ id: order.id, number: order.number }),
    "order",
  );
  await tx.insert(orderLine).values(
    p.lines.map((l) => ({
      orderId: saved.id,
      productId: l.productId,
      quantity: l.quantity,
      unitPriceCzk: l.unitPriceCzk,
    })),
  );
  const notificationIds = await notifyAfterOrder(tx, p, { id: saved.id, source }, taken, meta.createdBy);
  return { ...saved, notificationIds };
}

/**
 * Notifications an order causes, in its transaction (spec 002 FR-001): every staff member but its
 * author learns of the new order (FR-020); the owner's warning when a
 * product reaches the warning share of its daily limit, once per product and day (FR-017), and — for
 * an order staff add after the day's summary went out — the other staff learn the plan changed (FR-018).
 */
async function notifyAfterOrder(
  tx: Tx,
  p: PreparedOrder,
  saved: { id: string; source: OrderSourceValue },
  taken: { productId: string; name: string; dailyLimit: number; reserved: number }[],
  createdBy: string | null,
): Promise<string[]> {
  const ids = await notifyStaff(tx, {
    kind: "new_order",
    subject: subjectOf.newOrder(saved.id),
    text: notificationText.newOrder({
      orderId: saved.id,
      day: p.pickupDate,
      weekdayName: p.pickupWeekdayName,
      channel: saved.source,
    }),
    except: createdBy ?? undefined,
  });
  for (const t of taken) {
    if (t.dailyLimit <= 0 || t.reserved < Math.ceil(t.dailyLimit * NEAR_LIMIT_SHARE)) continue;
    ids.push(
      ...(await notifyStaff(tx, {
        kind: "near_limit",
        subject: subjectOf.nearLimit(t.productId, p.pickupDate),
        text: notificationText.nearLimit({
          day: p.pickupDate,
          weekdayName: p.pickupWeekdayName,
          product: t.name,
          left: t.dailyLimit - t.reserved,
        }),
      })),
    );
  }
  if (createdBy && (await subjectNotified(tx, subjectOf.planSummary(p.pickupDate))))
    ids.push(
      ...(await notifyStaff(tx, {
        kind: "plan_changed",
        subject: subjectOf.planChanged(saved.id),
        text: notificationText.planChanged({ day: p.pickupDate, weekdayName: p.pickupWeekdayName }),
        except: createdBy,
      })),
    );
  return ids;
}

const overLimit = (e: unknown) => {
  if (e instanceof OverLimit) return { ok: false, reason: "over_limit" } as const;
  throw e;
};

/** Saves a draft as an order, once, and only for its owner (FR-006, FR-019). */
export async function confirmDraft(
  db: Db,
  draftId: string,
  owner: DraftOwner,
  meta: ConfirmMeta,
  now = new Date(),
): Promise<ConfirmResult> {
  const who = ownerColumns(owner);
  // The day is checked again at the yes, not only at the read-back: a call can cross the cut-off in
  // between, and the owner can close a day. Staff keep their cut-off override (FR-007, FR-013, R30).
  const { schedule } = await loadBakery(db);
  return db
    .transaction(async (tx) => {
      const [draft] = await tx
        .select()
        .from(orderDraft)
        .where(
          and(
            eq(orderDraft.id, draftId),
            gt(orderDraft.expiresAt, now),
            isNull(orderDraft.confirmedOrderId),
            ownedBy(owner),
          ),
        )
        .for("update");
      if (!draft) return { ok: false, reason: "no_draft" } as const;
      const payload = draft.payload as PreparedOrder;
      const refusal = checkPickupDay(payload.pickupDate, now, schedule, draft.channel === "staff");
      if (refusal) return refusal as Extract<ConfirmResult, { reason: RefusalReason }>;
      const saved = await insertOrder(tx, payload, draft.channel, { ...meta, ...who });
      await tx.update(orderDraft).set({ confirmedOrderId: saved.id }).where(eq(orderDraft.id, draft.id));
      return {
        ok: true,
        orderNumber: saved.number,
        orderId: saved.id,
        notificationIds: saved.notificationIds,
      } as const;
    })
    .catch(overLimit);
}

/** Saves an order the customer confirmed in the web form in the same request (FR-014). */
export async function placeWebOrder(db: Db, prepared: PreparedOrder): Promise<ConfirmResult> {
  return db
    .transaction(async (tx) => {
      const saved = await insertOrder(tx, prepared, "web", {
        promptVersion: null,
        model: null,
        callId: null,
        createdBy: null,
      });
      return {
        ok: true,
        orderNumber: saved.number,
        orderId: saved.id,
        notificationIds: saved.notificationIds,
      } as const;
    })
    .catch(overLimit);
}

export async function orderNumbersForCall(db: Db, callId: string): Promise<number[]> {
  const rows = await db.select({ number: order.number }).from(order).where(eq(order.callId, callId));
  return rows.map((r) => r.number);
}
