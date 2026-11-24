import { ProvozResponse } from "@bakery/core/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/http";

export const provozKeys = { period: (days: number) => ["provoz", days] as const };

/** The owner's view of the phone agent over the last `days` days (FR-033). */
export const useProvoz = (days: number) =>
  useQuery({ queryKey: provozKeys.period(days), queryFn: () => api(`/api/staff/provoz?days=${days}`, ProvozResponse) });
