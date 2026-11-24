import { z } from "zod";
import { TranscriptTurn } from "./orders.ts";

export const RequestKind = z.enum(["callback", "change", "cancel"]);
export const RequestOrigin = z.enum(["agent", "promised_not_recorded", "web"]);

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
});
export type StaffRequestItem = z.infer<typeof StaffRequestItem>;

/** GET /api/staff/requests — open requests oldest first, then the latest handled ones (FR-008, FR-034, FR-041). */
export const StaffRequestsResponse = z.object({ open: z.array(StaffRequestItem), done: z.array(StaffRequestItem) });
export type StaffRequestsResponse = z.infer<typeof StaffRequestsResponse>;

/** PATCH /api/staff/requests/:id — mark handled, or reopen a request marked by mistake. */
export const SetRequestDoneBody = z.object({ done: z.boolean() });
export type SetRequestDoneBody = z.infer<typeof SetRequestDoneBody>;
