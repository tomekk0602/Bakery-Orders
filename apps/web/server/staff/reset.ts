import "server-only";
import { seedBakery, seedDemoOrders, truncateBakery } from "@bakery/db";
import { db } from "../runtime";

/** Restores the seeded bakery, catalogue and orders; staff accounts are kept (FR-042). */
export async function resetDemo(): Promise<void> {
  await truncateBakery(db());
  await seedBakery(db());
  await seedDemoOrders(db());
}
