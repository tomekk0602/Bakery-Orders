// Code hygiene enforced by tooling, not by memory (ADR-0015): no `any`, no `console`, no file over
// 300 lines, React hook rules. Applies to every workspace; the spike harness is exempt.
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/.next/**", "**/.expo/**", "**/dist/**", "spikes/**", "**/migrations/**", "**/next-env.d.ts", "**/expo-env.d.ts"] },
  ...tseslint.configs.strict,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": "error",
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Tests and scripts may print and may be longer.
    files: ["**/*.test.{ts,tsx}", "**/test/**", "**/scripts/**"],
    rules: { "no-console": "off", "max-lines": "off", "@typescript-eslint/no-non-null-assertion": "off" },
  },
);
