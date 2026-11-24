import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)),
    },
  },
  test: { environment: "node", testTimeout: 30_000, hookTimeout: 180_000, include: ["**/*.test.ts"], exclude: ["node_modules", ".next"] },
});
