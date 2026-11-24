import "server-only";
import { randomBytes } from "node:crypto";
import { PROMPT_VERSION } from "@bakery/core";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { createTraceId, propagateAttributes, setLangfuseTracerProvider } from "@langfuse/tracing";
import { type SpanContext, TraceFlags } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { after } from "next/server";
import { log } from "./log";
import { maskPersonalData } from "./mask";

const g = globalThis as unknown as { __bakeryTelemetry?: LangfuseSpanProcessor | null };

/**
 * Langfuse (EU) through OpenTelemetry (ADR-0013, research R19). Its own tracer provider, not the
 * global one, so only our observations are exported, not every Next.js span. Without the keys tracing
 * is off — said once in the log — and every observation is a no-op.
 */
export function startTelemetry(): void {
  if (g.__bakeryTelemetry !== undefined) return;
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    g.__bakeryTelemetry = null;
    log.info("tracing off: LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY not set");
    return;
  }
  const processor = new LangfuseSpanProcessor({
    mask: ({ data }) => maskPersonalData(data),
    environment: process.env.VERCEL_ENV ?? "development",
    release: PROMPT_VERSION,
  });
  setLangfuseTracerProvider(new NodeTracerProvider({ spanProcessors: [processor] }));
  g.__bakeryTelemetry = processor;
  log.info({ baseUrl: process.env.LANGFUSE_BASE_URL }, "tracing on: Langfuse");
}

/**
 * Serverless functions may freeze once the response is sent, so the spans of a request are exported
 * after it, within the request's lifetime (`after`). With tracing off there is nothing to export.
 */
function scheduleFlush(): void {
  const processor = g.__bakeryTelemetry;
  if (!processor) return;
  after(() => processor.forceFlush().catch((e: unknown) => log.warn({ err: e }, "trace export failed")));
}

/** The trace id a call's observations share across its requests: derived from the call id. */
export const callTraceId = (callId: string) => createTraceId(callId);

/**
 * Runs `fn` inside the call's trace. A call is several requests (start, each tool, end) in separate
 * function invocations; the shared trace id joins them into one trace (research R27).
 */
export async function inCallTrace<T>(callId: string, fn: (parent: SpanContext) => Promise<T>): Promise<T> {
  const parent: SpanContext = {
    traceId: await callTraceId(callId),
    spanId: randomBytes(8).toString("hex"),
    traceFlags: TraceFlags.SAMPLED,
  };
  try {
    return await propagateAttributes(
      { traceName: "call", sessionId: callId, version: PROMPT_VERSION, tags: ["phone"] },
      () => fn(parent),
    );
  } finally {
    scheduleFlush();
  }
}

/** Runs `fn` as its own trace — a staff dictation. The user id is the opaque staff id, never a name. */
export async function inTrace<T>(name: string, userId: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await propagateAttributes({ traceName: name, userId, version: PROMPT_VERSION, tags: ["staff"] }, fn);
  } finally {
    scheduleFlush();
  }
}
