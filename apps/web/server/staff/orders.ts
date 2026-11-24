import "server-only";
import { pragueDate } from "@bakery/core";
import { StaffOrderDetail, StaffOrdersResponse, type SetOrderStatusBody } from "@bakery/core/contracts";
import { cancelOrder, getOrderDetail, listOrdersForDay, setOrderHandedOver, type CancelResult } from "@bakery/db";
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

/** Hand over, undo, or cancel; a cancel gives the quantities back to the day's limits (FR-012, FR-013). */
export const setOrderStatus = (id: string, body: SetOrderStatusBody): Promise<CancelResult> =>
  body.status === "cancelled" ? cancelOrder(db(), id) : setOrderHandedOver(db(), id, body.status);
