import { z } from "zod";
import { requirePermission } from "@/server/auth";
import { REFUSAL_MESSAGES } from "@/server/refusals";
import { fail, json } from "@/server/runtime";
import { confirmStaffDraft } from "@/server/staff/new-order";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/staff/drafts/:id/confirm — saves the staff member's own draft (FR-019). */
export async function POST(req: Request, { params }: Ctx) {
  const r = await requirePermission(req, "order:create");
  if ("response" in r) return r.response;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return fail("no_draft", "Objednávka k potvrzení neexistuje nebo už byla uložena.", 404);
  const result = await confirmStaffDraft(id, r.user.id);
  if (result.ok) return json({ orderId: result.orderId, orderNumber: result.orderNumber });
  if (result.reason === "over_limit")
    return fail("over_limit", "Takové množství už na tento den nemáme. Upravte objednávku.", 409);
  if (result.reason === "no_draft")
    return fail("no_draft", "Objednávka k potvrzení neexistuje nebo už byla uložena.", 404);
  // the day stopped being orderable between the card and the tap (research R30)
  return fail(result.reason, REFUSAL_MESSAGES[result.reason], 422);
}
