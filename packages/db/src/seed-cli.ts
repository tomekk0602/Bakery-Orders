import { createDb } from "./client.ts";
import { seedDemoOrders } from "./demo-orders.ts";
import { seedBakery } from "./seed.ts";

const { db, pool } = createDb();
await seedBakery(db);
await seedDemoOrders(db);
await pool.end();
process.stdout.write("seeded Pekárna U Lípy\n");
