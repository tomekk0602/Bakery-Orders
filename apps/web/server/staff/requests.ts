import "server-only";
import { StaffRequestsResponse } from "@bakery/core/contracts";
import { listStaffRequests, setStaffRequestDone } from "@bakery/db";
import { db } from "../runtime";

export const staffRequests = async (): Promise<StaffRequestsResponse> =>
  StaffRequestsResponse.parse(await listStaffRequests(db()));

export const setRequestDone = (id: string, done: boolean): Promise<boolean> => setStaffRequestDone(db(), id, done);
