import { z } from "zod";
import type { CalendarDay } from "../calendar.ts";
import { activeProducts, type Product } from "../catalogue.ts";

export type AgentMode = "customer" | "staff";

export const STAFF_REQUEST_KINDS = ["callback", "change", "cancel"] as const;

/**
 * Tool schemas for one session. Product ids are an enum of the active catalogue and the pickup day an
 * enum of the calendar's open days, so a product outside the offer or a day outside the calendar
 * cannot be expressed (ADR-0010 point 1, research R25); the server validates again (ADR-0003).
 */
export function buildToolSchemas(catalogue: readonly Product[], calendar: readonly CalendarDay[]) {
  const ids = activeProducts(catalogue).map((p) => p.id);
  const days = calendar.filter((d) => !d.closed).map((d) => d.date);
  if (ids.length === 0 || days.length === 0) throw new Error("buildToolSchemas: no active products or no open days");
  const productId = z.enum(ids as [string, ...string[]]);
  return {
    prepare_order: z.object({
      items: z
        .array(z.object({ product_id: productId, quantity: z.number().int().min(1).max(200) }))
        .min(1)
        .max(20),
      pickup_date: z.enum(days as [string, ...string[]]),
      customer_name: z.string().trim().min(1).max(80),
    }),
    confirm_order: z.object({ draft_id: z.string().min(1) }),
    request_staff: z.object({
      kind: z.enum(STAFF_REQUEST_KINDS),
      customer_name: z.string().trim().max(80).optional(),
      note: z.string().trim().min(1).max(500),
    }),
  };
}

export type ToolSchemas = ReturnType<typeof buildToolSchemas>;
export type ToolName = keyof ToolSchemas;
export const TOOL_NAMES = ["prepare_order", "confirm_order", "request_staff"] as const satisfies readonly ToolName[];

// The descriptions say when NOT to call (ADR-0010 point 2). Czech, because the model works in Czech.
const DESCRIPTIONS: Record<ToolName, string> = {
  prepare_order:
    "Připraví objednávku k potvrzení a vrátí řádky s cenami a celkovou cenu. Objednávku NEUKLÁDÁ. " +
    "Nevolej, dokud zákazník jasně neřekl každý produkt, množství, den vyzvednutí a jméno. " +
    "Když slovo neodpovídá žádnému produktu z nabídky nebo mu nerozumíš, produkt nedomýšlej a zeptej se.",
  confirm_order:
    "Uloží naposledy připravenou objednávku (draft_id z výsledku prepare_order) a vrátí číslo objednávky. " +
    "Volej JEN poté, co zákazník výslovně souhlasil s přečteným shrnutím.",
  request_staff:
    "Zaznamená požadavek pro člověka z pekárny: callback (zavolat zákazníkovi), change (změna existující " +
    "objednávky) nebo cancel (zrušení existující objednávky). Volej, když zákazník chce mluvit s člověkem, " +
    "chce změnit nebo zrušit objednávku, nebo když ani na druhý pokus nerozumíš, co chce.",
};

export type ToolDeclaration = { name: ToolName; description: string; parametersJsonSchema: Record<string, unknown> };

/** Provider-neutral declarations (JSON Schema). Staff confirm in the UI, so staff mode has no confirm_order. */
export function toolDeclarations(schemas: ToolSchemas, mode: AgentMode): ToolDeclaration[] {
  const names: ToolName[] = mode === "staff" ? ["prepare_order"] : [...TOOL_NAMES];
  return names.map((name) => {
    const { $schema: _ignored, ...parametersJsonSchema } = z.toJSONSchema(schemas[name]) as Record<string, unknown>;
    return { name, description: DESCRIPTIONS[name], parametersJsonSchema };
  });
}
