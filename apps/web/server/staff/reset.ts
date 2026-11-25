import "server-only";
import { seedBakery, seedDemoOrders, seedDemoRequests, truncateBakery } from "@bakery/db";
import { db } from "../runtime";

/**
 * Restores the seeded bakery, catalogue and orders and empties the staff notifications; staff
 * accounts are kept. One transaction: either all of it happens or nothing changes (FR-042, FR-081).
 */
export async function resetDemo(): Promise<void> {
  await db().transaction(async (tx) => {
    await truncateBakery(tx);
    await seedBakery(tx);
    await seedDemoOrders(tx);
    await seedDemoRequests(tx);
  });
}
