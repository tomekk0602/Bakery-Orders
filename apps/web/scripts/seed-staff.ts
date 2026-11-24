// Creates the two demo staff accounts (ADR-0015): one owner, one employee.
// Passwords come from DEMO_OWNER_PASSWORD / DEMO_EMPLOYEE_PASSWORD; when unset, random ones are
// generated and written to .demo-credentials.local (git-ignored), never to the repository.
// Run: npm run seed:staff -w @bakery/web
import { randomBytes } from "node:crypto";
import { chmodSync, writeFileSync } from "node:fs";
import type { Role } from "@bakery/core";
import { user } from "@bakery/db";
import { eq } from "drizzle-orm";
import { auth } from "../server/auth.ts";
import { db } from "../server/runtime.ts";

const ACCOUNTS: { role: Role; name: string; email: string; env: string }[] = [
  { role: "owner", name: "Majitel", email: "majitel@pekarna-u-lipy.test", env: "DEMO_OWNER_PASSWORD" },
  { role: "employee", name: "Prodavač", email: "prodavac@pekarna-u-lipy.test", env: "DEMO_EMPLOYEE_PASSWORD" },
];

const generated: string[] = [];
for (const a of ACCOUNTS) {
  const [existing] = await db().select({ id: user.id }).from(user).where(eq(user.email, a.email));
  if (existing) continue;
  const password = process.env[a.env] ?? randomBytes(9).toString("base64url");
  await auth().api.createUser({ body: { email: a.email, password, name: a.name, role: a.role } });
  if (!process.env[a.env]) generated.push(`${a.role}: ${a.email} / ${password}`);
}

if (generated.length) {
  const file = new URL("../.demo-credentials.local", import.meta.url);
  writeFileSync(file, generated.join("\n") + "\n");
  chmodSync(file, 0o600);
  process.stdout.write(`created ${generated.length} account(s); credentials in apps/web/.demo-credentials.local\n`);
} else {
  process.stdout.write("staff accounts present\n");
}
process.exit(0);
