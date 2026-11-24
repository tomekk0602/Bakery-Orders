import "server-only";
import pino from "pino";

/** The server's one logger. Never log call content, names or phone numbers (ADR-0008, ADR-0013). */
export const log = pino({ level: process.env.LOG_LEVEL ?? "info", base: { service: "bakery-web" } });
