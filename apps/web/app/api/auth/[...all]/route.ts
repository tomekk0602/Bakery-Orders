import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";

// Better Auth's own routes (sign-in, session, sign-out) — FR-015.
export const { GET, POST } = toNextJsHandler((req: Request) => auth().handler(req));
