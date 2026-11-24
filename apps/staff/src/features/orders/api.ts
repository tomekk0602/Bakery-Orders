import { StaffOrderDetail, StaffOrdersResponse, type SetOrderStatusBody } from "@bakery/core/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "@/shared/api/http";

export const orderKeys = {
  all: ["orders"] as const,
  day: (day: string | null) => [...orderKeys.all, "day", day ?? "today"] as const,
  detail: (id: string) => [...orderKeys.all, "detail", id] as const,
};

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
