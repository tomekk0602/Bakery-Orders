import { StaffRequestsResponse } from "@bakery/core/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "@/shared/api/http";

export const requestKeys = { all: ["requests"] as const };

/**
 * How often open requests are re-read while the app is open: a callback the agent recorded should
 * show up without pulling to refresh. 30 s is a proposed value, not measured (FR-041).
 */
export const REQUESTS_REFRESH_MS = 30_000;

export const useRequests = (enabled = true) =>
  useQuery({
    queryKey: requestKeys.all,
    queryFn: () => api("/api/staff/requests", StaffRequestsResponse),
    enabled,
    refetchInterval: REQUESTS_REFRESH_MS,
  });

const Ok = z.object({ ok: z.literal(true) });

export function useSetRequestDone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      api(`/api/staff/requests/${id}`, Ok, { method: "PATCH", body: JSON.stringify({ done }) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: requestKeys.all }),
  });
}
