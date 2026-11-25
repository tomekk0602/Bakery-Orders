import {
  CancelFromRequestResult,
  type RequestActionBody,
  RequestArchivePage,
  type RequestOutcome,
  StaffRequestsResponse,
} from "@bakery/core/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { notificationKeys } from "@/features/notifications/api";
import { refreshOrderViews } from "@/features/orders/api";
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

/**
 * The owner's archive, 20 a page with "Načíst starší" (FR-054, FR-055). Under the requests key, so a
 * reopen or a close refreshes it too.
 */
export const useRequestArchive = (filter: { outcome?: RequestOutcome; q: string }) =>
  useInfiniteQuery({
    queryKey: [...requestKeys.all, "archive", filter.outcome ?? "all", filter.q] as const,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (filter.outcome) params.set("outcome", filter.outcome);
      if (filter.q) params.set("q", filter.q);
      if (pageParam) params.set("cursor", pageParam);
      return api(`/api/staff/requests/archive?${params.toString()}`, RequestArchivePage);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

const Ok = z.object({ ok: z.literal(true) });

/** One step on a request: call, unanswered, handled, unreachable, reopen (FR-047–FR-051). */
export function useRequestAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & RequestActionBody) =>
      api(`/api/staff/requests/${id}`, Ok, { method: "PATCH", body: JSON.stringify(body) }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: requestKeys.all }),
        // closing a request reads its notifications: the bell follows at once (spec 002 FR-029)
        queryClient.invalidateQueries({ queryKey: notificationKeys.list }),
      ]),
  });
}

/** Cancel the customer's order and close the request in one step (FR-052). */
export function useCancelFromRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, orderId }: { id: string; orderId: string }) =>
      api(`/api/staff/requests/${id}/cancel-order`, CancelFromRequestResult, {
        method: "POST",
        body: JSON.stringify({ orderId }),
      }),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: requestKeys.all });
      await refreshOrderViews(queryClient);
      await queryClient.invalidateQueries({ queryKey: notificationKeys.list });
    },
  });
}
