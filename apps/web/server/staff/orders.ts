import "server-only";
import { pragueDate } from "@bakery/core";
import { StaffOrderDetail, StaffOrdersResponse, type SetOrderStatusBody } from "@bakery/core/contracts";
import { getOrderDetail, listOrdersForDay, setOrderHandedOver, type SetStatusResult } from "@bakery/db";
import { db } from "../runtime";

/** The orders to hand over on a day; the day defaults to today in Prague, so the app never guesses it. */
export async function ordersForDay(day: string | null, now = new Date()): Promise<StaffOrdersResponse> {
  const d = day ?? pragueDate(now);
  return StaffOrdersResponse.parse({ day: d, orders: await listOrdersForDay(db(), d) });
}

export async function orderDetail(id: string): Promise<StaffOrderDetail | null> {
  const detail = await getOrderDetail(db(), id);
  return detail ? StaffOrderDetail.parse(detail) : null;
}

export const setHandedOver = (id: string, body: SetOrderStatusBody): Promise<SetStatusResult> =>
  setOrderHandedOver(db(), id, body.status);
