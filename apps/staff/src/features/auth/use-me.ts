import { StaffMeResponse } from "@bakery/core/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/http";

export const authKeys = { me: ["staff", "me"] as const };

/** The signed-in staff member and their permissions, from the server (FR-045). */
export const useMe = () => useQuery({ queryKey: authKeys.me, queryFn: () => api("/api/staff/me", StaffMeResponse) });
