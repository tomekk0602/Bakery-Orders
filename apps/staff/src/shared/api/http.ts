import { ApiError } from "@bakery/core/contracts";
import { Platform } from "react-native";
import type { z } from "zod";
import { authClient } from "../auth/client";
import { API_URL } from "../config";

/** An API failure with the server's code and Czech message (contracts/http-api.md). */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function sessionHeaders(): Promise<Record<string, string>> {
  // On the phone the session cookie is in SecureStore and must be sent by hand; the browser sends it itself.
  if (Platform.OS === "web") return {};
  const cookie = await authClient.getCookie();
  return cookie ? { cookie } : {};
}

/** The one HTTP client: every response is validated with the shared contract before it is used. */
export async function api<S extends z.ZodType>(path: string, schema: S, init: RequestInit = {}): Promise<z.infer<S>> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: Platform.OS === "web" ? "include" : "omit",
    headers: { "content-type": "application/json", ...(await sessionHeaders()), ...(init.headers as Record<string, string>) },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = ApiError.safeParse(body);
    throw new ApiRequestError(res.status, err.success ? err.data.error.code : "http_error", err.success ? err.data.error.message : "Server neodpovídá.");
  }
  return schema.parse(body);
}
