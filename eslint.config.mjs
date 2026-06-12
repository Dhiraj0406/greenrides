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
  // Downgrade noisy React hooks purity/refs rules that fire on legitimate patterns
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated files — never hand-edited
    "src/generated/**",
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
