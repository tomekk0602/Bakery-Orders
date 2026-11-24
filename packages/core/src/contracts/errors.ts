import { z } from "zod";

/** The error envelope every route returns: an English code for logs, a Czech message for screens. */
export const ApiError = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
export type ApiError = z.infer<typeof ApiError>;
