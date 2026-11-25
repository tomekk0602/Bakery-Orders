import "server-only";
import {
  type RequestActionBody,
  RequestArchivePage,
  type RequestArchiveQuery,
  StaffRequestsResponse,
} from "@bakery/core/contracts";
import { actOnRequest, archivePage, cancelOrderFromRequest, listStaffRequests } from "@bakery/db";
import { db } from "../runtime";

export const staffRequests = async (): Promise<StaffRequestsResponse> =>
  StaffRequestsResponse.parse(await listStaffRequests(db()));

export const actOn = (id: string, userId: string, body: RequestActionBody) =>
  actOnRequest(db(), { id, userId, action: body.action, note: body.note });

export const cancelFromRequest = (requestId: string, orderId: string, userId: string) =>
  cancelOrderFromRequest(db(), { requestId, orderId, userId });

export const requestArchive = async (q: RequestArchiveQuery): Promise<RequestArchivePage> =>
  RequestArchivePage.parse(await archivePage(db(), q));
