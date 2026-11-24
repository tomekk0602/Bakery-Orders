import "server-only";
import { createHash } from "node:crypto";
import { createDb, type Db } from "@bakery/db";
import { GoogleGenAI } from "@google/genai";

export { LIVE_MODEL } from "@bakery/core";

const isProduction = process.env.NODE_ENV === "production";

export function required(name: string, devDefault?: string): string {
  const v = process.env[name];
  if (v) return v;
  if (!isProduction && devDefault !== undefined) return devDefault;
  throw new Error(`${name} is not set`);
}

// One pool per server process; Next.js dev reloads modules, so it is kept on globalThis.
const g = globalThis as unknown as { __bakeryDb?: Db; __bakeryGenAi?: GoogleGenAI };

export function db(): Db {
  // The local Docker database is the development default (docker-compose.yml); production must set it.
  g.__bakeryDb ??= createDb(required("DATABASE_URL", "postgres://bakery:bakery@localhost:5433/bakery")).db;
  return g.__bakeryDb;
}

export function genai(): GoogleGenAI {
  g.__bakeryGenAi ??= new GoogleGenAI({ apiKey: required("GEMINI_API_KEY"), httpOptions: { apiVersion: "v1beta" } });
  return g.__bakeryGenAi;
}

/** A salted hash of the client IP: enough for per-IP limits, never the IP itself (ADR-0014). */
export function ipHash(req: Request): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  return createHash("sha256")
    .update(required("IP_HASH_SALT", "development-only-salt"))
    .update(ip)
    .digest("hex")
    .slice(0, 32);
}

export const json = (body: unknown, status = 200) => Response.json(body, { status });
export const fail = (code: string, message: string, status: number) => json({ error: { code, message } }, status);
