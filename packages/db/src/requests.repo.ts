import type { StaffRequestItem, TranscriptTurn } from "@bakery/core/contracts";
import { asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import type { Db } from "./client.ts";
import { call, staffRequest } from "./schema.ts";

/** How many handled requests the list keeps showing. */
export const RECENT_DONE = 20;

const columns = {
  id: staffRequest.id,
  kind: staffRequest.kind,
  origin: staffRequest.origin,
  customerName: staffRequest.customerName,
  customerPhone: staffRequest.customerPhone,
  note: staffRequest.note,
  createdAt: staffRequest.createdAt,
  doneAt: staffRequest.doneAt,
  transcript: call.transcript,
};

type Row = Pick<
  typeof staffRequest.$inferSelect,
  "id" | "kind" | "origin" | "customerName" | "customerPhone" | "note" | "createdAt" | "doneAt"
> & { transcript: unknown };

const toItem = (r: Row): StaffRequestItem => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
  doneAt: r.doneAt?.toISOString() ?? null,
  transcript: (r.transcript as TranscriptTurn[] | null) ?? null,
});

/** Open requests, oldest first (they have waited longest), and the latest handled ones. */
export async function listStaffRequests(db: Db): Promise<{ open: StaffRequestItem[]; done: StaffRequestItem[] }> {
  const base = () => db.select(columns).from(staffRequest).leftJoin(call, eq(call.id, staffRequest.callId));
  const open = await base().where(isNull(staffRequest.doneAt)).orderBy(asc(staffRequest.createdAt));
  const done = await base().where(isNotNull(staffRequest.doneAt)).orderBy(desc(staffRequest.doneAt)).limit(RECENT_DONE);
  return { open: open.map(toItem), done: done.map(toItem) };
}

/** Marks a request handled, or reopens it. False when it does not exist. */
export async function setStaffRequestDone(db: Db, id: string, done: boolean, now = new Date()): Promise<boolean> {
  const updated = await db
    .update(staffRequest)
    .set({ doneAt: done ? now : null })
    .where(eq(staffRequest.id, id))
    .returning({ id: staffRequest.id });
  return updated.length > 0;
}
