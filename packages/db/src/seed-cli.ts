import { createDb } from "./client.ts";
import { seedBakery } from "./seed.ts";

const { db, pool } = createDb();
await seedBakery(db);
await pool.end();
console.log("seeded Pekárna U Lípy");
