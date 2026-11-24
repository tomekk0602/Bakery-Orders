import { NextResponse, type NextRequest } from "next/server";
import { TRUSTED_ORIGINS } from "./server/origins";

// CORS for the staff app's web build, which runs on its own origin (ADR-0015). Native apps send no
// Origin header and are not affected. Sessions travel as cookies, so credentials are allowed only
// for the trusted origins.
const CORS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
  "Access-Control-Allow-Credentials": "true",
};

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = TRUSTED_ORIGINS.includes(origin);
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: allowed ? { "Access-Control-Allow-Origin": origin, ...CORS } : {},
    });
  }
  const response = NextResponse.next();
  if (allowed) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    for (const [k, v] of Object.entries(CORS)) response.headers.set(k, v);
  }
  return response;
}

export const config = { matcher: ["/api/staff/:path*", "/api/auth/:path*"] };
