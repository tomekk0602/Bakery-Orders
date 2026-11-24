import { createDb } from "./client.ts";
import { seedBakery } from "./seed.ts";

const { db, pool } = createDb();
await seedBakery(db);
await pool.end();
process.stdout.write("seeded Pekárna U Lípy\n");
