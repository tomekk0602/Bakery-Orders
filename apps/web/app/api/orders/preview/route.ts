import { previewWebOrder, WEB_PREVIEW_LIMIT } from "@/server/customer/orders";
import { readWebOrder, refuse } from "@/server/customer/respond";
import { json } from "@/server/runtime";

/** POST /api/orders/preview — public: the summary to confirm, priced by the server, kept as a draft (FR-064). */
export async function POST(req: Request) {
  const input = await readWebOrder(req, "web-preview", WEB_PREVIEW_LIMIT);
  if (input instanceof Response) return input;
  const r = await previewWebOrder(input);
  return r.ok ? json(r.review) : refuse(r.reason);
}
