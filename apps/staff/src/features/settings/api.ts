import { BakerySettings } from "@bakery/core/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { planKeys } from "@/features/plan/api";
import { api } from "@/shared/api/http";

export const settingsKeys = { all: ["settings"] as const };

export const useSettings = () => useQuery({ queryKey: settingsKeys.all, queryFn: () => api("/api/staff/settings", BakerySettings) });

/** Saves the whole document; prices, buffers and closed days change the plan and the order form. */
export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (s: BakerySettings) => api("/api/staff/settings", BakerySettings, { method: "PUT", body: JSON.stringify(s) }),
    onSuccess: (saved) => {
      queryClient.setQueryData(settingsKeys.all, saved);
      return Promise.all([queryClient.invalidateQueries({ queryKey: planKeys.all }), queryClient.invalidateQueries({ queryKey: ["order-form"] })]);
    },
  });
}

/** "Reset demo" restores the seed (FR-042); everything on screen is stale after it. */
export function useResetDemo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api("/api/staff/reset", z.object({ ok: z.literal(true) }), { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
