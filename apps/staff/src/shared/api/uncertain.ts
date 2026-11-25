/**
 * Whether a failed request may still have changed something on the server: no response, a server
 * error, or a response we could not read. Only a 4xx answer is a clear refusal (spec 001 FR-077).
 */
export function isUncertain(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return !(typeof status === "number" && status >= 400 && status < 500);
}
