import { z } from "zod";
import { ALL_PERMISSIONS, ROLES, type Permission } from "../permissions.ts";

export const StaffUser = z.object({ id: z.string(), name: z.string(), email: z.string(), role: z.enum(ROLES) });
export type StaffUser = z.infer<typeof StaffUser>;

/** GET /api/staff/me */
export const StaffMeResponse = z.object({
  user: StaffUser,
  permissions: z.array(z.enum(ALL_PERMISSIONS as [Permission, ...Permission[]])),
});
export type StaffMeResponse = z.infer<typeof StaffMeResponse>;
