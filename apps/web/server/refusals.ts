import "server-only";
import type { RefusalReason } from "@bakery/core";

/** Czech messages for the core's refusals, shown on the order card (contracts/http-api.md). */
export const REFUSAL_MESSAGES: Record<RefusalReason, string> = {
  empty_order: "Přidejte alespoň jeden výrobek.",
  invalid_quantity: "Neplatné množství.",
  unknown_product: "Tento výrobek není v nabídce.",
  past_day: "Tento den už minul.",
  outside_window: "Objednávky přijímáme nejvýše 14 dní dopředu.",
  closed_day: "V tento den je zavřeno.",
  after_cutoff: "Na tento den už objednávky nepřijímáme.",
  over_limit: "Takové množství už na tento den nemáme.",
  missing_name: "Zadejte jméno zákazníka.",
  missing_phone: "Zadejte telefon zákazníka.",
};
