/** Next.js runs this once per server instance (FR-032): tracing to Langfuse when its keys are set. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startTelemetry } = await import("./server/telemetry");
  startTelemetry();
}
