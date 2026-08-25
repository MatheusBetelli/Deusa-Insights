import js from "@eslint/js";
import sonarjs from "eslint-plugin-sonarjs";
import globals from "globals";
import tseslint from "typescript-eslint";

const projectFiles = ["src/**/*.ts", "prisma/**/*.ts", "scripts/generate-quality-report.ts"];

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  { ...sonarjs.configs.recommended, files: projectFiles },
  {
    files: projectFiles,
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/**/*.spec.ts"],
    rules: {
      "sonarjs/no-hardcoded-passwords": "off",
    },
  },
);
