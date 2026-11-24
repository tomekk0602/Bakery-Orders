import { catalogue } from "@/server/customer/orders";
import { json } from "@/server/runtime";

/** GET /api/catalogue — public: products and the days still open for orders (FR-014). */
export async function GET() {
  return json(await catalogue());
}
