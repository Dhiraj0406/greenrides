import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Module boundary enforcement: cross-module imports must use @/modules/<name>/... not ../../
  {
    files: ["src/modules/**/*.ts", "src/modules/**/*.tsx"],
    rules: {
      "no-restricted-imports": ["warn", {
        patterns: [
          {
            group: ["../../*"],
            message: "Cross-module imports must use the @/modules/<name>/... alias, not relative ../../ paths.",
          },
        ],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
