import { BakingPlanResponse } from "@bakery/core/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/http";

export const planKeys = { all: ["plan"] as const, day: (day: string | null) => ["plan", day ?? "next"] as const };

/** The baking plan; `null` lets the server pick the next open day (FR-010). */
export const usePlan = (day: string | null) =>
  useQuery({ queryKey: planKeys.day(day), queryFn: () => api(`/api/staff/plan${day ? `?day=${day}` : ""}`, BakingPlanResponse) });
