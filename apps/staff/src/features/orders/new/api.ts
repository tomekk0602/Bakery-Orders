import { ConfirmDraftResponse, OrderCard, OrderFormResponse, type StaffOrderInput } from "@bakery/core/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { planKeys } from "@/features/plan/api";
import { api } from "@/shared/api/http";
import { orderKeys } from "../api";

export const useOrderForm = () => useQuery({ queryKey: ["order-form"], queryFn: () => api("/api/staff/order-form", OrderFormResponse) });

/** Form → order card; the server prices it and saves nothing yet (FR-019). */
export const usePrepareOrder = () =>
  useMutation({ mutationFn: (input: StaffOrderInput) => api("/api/staff/orders", OrderCard, { method: "POST", body: JSON.stringify(input) }) });

/** Saves the card; the day's orders and the baking plan change, so both are refreshed. */
export function useConfirmDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draftId: string) => api(`/api/staff/drafts/${draftId}/confirm`, ConfirmDraftResponse, { method: "POST" }),
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: orderKeys.all }), queryClient.invalidateQueries({ queryKey: planKeys.all })]),
  });
}
