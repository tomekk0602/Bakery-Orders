import { StaffOrderDetail, StaffOrdersResponse, type SetOrderStatusBody } from "@bakery/core/contracts";
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { planKeys } from "@/features/plan/api";
import { api } from "@/shared/api/http";

export const orderKeys = {
  all: ["orders"] as const,
  day: (day: string | null) => [...orderKeys.all, "day", day ?? "today"] as const,
  detail: (id: string) => [...orderKeys.all, "detail", id] as const,
};

/**
 * Everything a saved or cancelled order changes on screen: the order lists, the detail and the baking
 * plan (spec 001 FR-062). One place, so a new kind of change cannot forget the plan again.
 */
export const refreshOrderViews = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: orderKeys.all }),
    queryClient.invalidateQueries({ queryKey: planKeys.all }),
  ]);

/** The day's orders; `null` lets the server pick today in Prague. */
export const useOrdersForDay = (day: string | null) =>
  useQuery({
    queryKey: orderKeys.day(day),
    queryFn: () => api(`/api/staff/orders${day ? `?day=${day}` : ""}`, StaffOrdersResponse),
  });

export const useOrder = (id: string) =>
  useQuery({ queryKey: orderKeys.detail(id), queryFn: () => api(`/api/staff/orders/${id}`, StaffOrderDetail) });

const Ok = z.object({ ok: z.literal(true) });

/** Hand an order over or undo it; every order list and the detail are refreshed after. */
export function useSetHandedOver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string } & SetOrderStatusBody) =>
      api(`/api/staff/orders/${id}`, Ok, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: orderKeys.all }),
  });
}

/** Cancel an order; the server gives its quantities back to the day's limits (FR-013). */
export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/staff/orders/${id}`, Ok, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) }),
    onSettled: () => refreshOrderViews(queryClient),
  });
}
