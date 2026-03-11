import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

import eslint from "@eslint/js"
import type { Linter } from "eslint"
import { defineConfig } from "eslint/config"
import simpleImportSortPlugin from "eslint-plugin-simple-import-sort"
import unusedImportsPlugin from "eslint-plugin-unused-imports"
import globals from "globals"
import tseslint from "typescript-eslint"

// =============================================================================
// SETUP
// =============================================================================

const rootDir =
  "path" in import.meta ? dirname(import.meta.path) : dirname(fileURLToPath(import.meta.url))

const asRule = (x: readonly ["off" | "warn" | "error", ...unknown[]]): Linter.RuleEntry =>
  x as unknown as Linter.RuleEntry

// =============================================================================
// NAMING CONVENTIONS
// =============================================================================

export const namingConvention = [
  "error",
  // Types & Enums
  { selector: "typeLike", format: ["PascalCase"] },
  { selector: "typeParameter", format: ["PascalCase"] },
  { selector: "enum", format: ["PascalCase"] },
  { selector: "enumMember", format: ["UPPER_CASE"] },
  { selector: "interface", format: null, custom: { regex: "^I[A-Z]", match: false } },

  // Functions & Methods
  { selector: "function", format: ["camelCase"] },
  { selector: "method", format: ["camelCase"] },
  { selector: "accessor", format: ["camelCase"] },

  // Variables
  { selector: "variable", format: ["camelCase", "PascalCase"] },
  {
    selector: "variable",
    modifiers: ["const", "global"],
    format: ["camelCase", "PascalCase", "UPPER_CASE"]
  },
  { selector: "variable", modifiers: ["destructured"], format: null },
  { selector: "variable", modifiers: ["unused"], format: null, leadingUnderscore: "allow" },

  // Parameters
  { selector: "parameter", format: ["camelCase"] },
  {
    selector: "parameter",
    modifiers: ["unused"],
    format: null,
    filter: { regex: "^_", match: true }
  },
  { selector: "parameterProperty", format: ["camelCase"] },

  // Imports
  { selector: "import", format: ["camelCase", "PascalCase", "UPPER_CASE"] },

  // Properties - allow flexibility for APIs/databases
  { selector: "property", format: ["camelCase", "PascalCase"] },
  { selector: "property", modifiers: ["requiresQuotes"], format: null },
  {
    selector: "property",
    format: null,
    filter: { regex: "^(__[a-z]+|[A-Z][A-Z0-9_]*|[a-z]+(_[a-z0-9]+)+)$", match: true }
  },
  {
    selector: "classProperty",
    modifiers: ["private"],
    format: ["camelCase"],
    leadingUnderscore: "allow"
  },
  { selector: "objectLiteralProperty", format: null },
  { selector: "objectLiteralMethod", format: ["camelCase"] },
  { selector: "typeProperty", format: null },

  // Default
  { selector: "default", format: ["camelCase"] }
] as const

// Backwards compatibility alias
export const namingConventionBase = namingConvention

export { asRule, rootDir }

// =============================================================================
// CONFIGURATION
// =============================================================================

export default defineConfig([
  // ---------------------------------------------------------------------------
  // Base TypeScript
  // ---------------------------------------------------------------------------
  {
    name: "typescript-strict",
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked
    ],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: { ...globals.browser, ...globals.node },
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: rootDir
      }
    },
    plugins: {
      "simple-import-sort": simpleImportSortPlugin,
      "unused-imports": unusedImportsPlugin
    },
    rules: {
      // -----------------------------------------------------------------------
      // Imports
      // -----------------------------------------------------------------------
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      "no-duplicate-imports": "error",

      // -----------------------------------------------------------------------
      // TypeScript
      // -----------------------------------------------------------------------
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" }
      ],
      "@typescript-eslint/consistent-type-exports": [
        "error",
        { fixMixedExportsWithInlineTypeSpecifier: true }
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true
        }
      ],
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/method-signature-style": ["error", "property"],
      "@typescript-eslint/naming-convention": asRule(namingConvention),
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        { requireDefaultForNonUnion: true }
      ],
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        { allowNumber: true, allowNullableObject: true }
      ],

      // Async
      "@typescript-eslint/promise-function-async": "error",
      "@typescript-eslint/return-await": ["error", "in-try-catch"],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } }
      ],

      // Error handling
      "@typescript-eslint/only-throw-error": "error",
      "@typescript-eslint/prefer-promise-reject-errors": "error",

      // Deprecation
      "@typescript-eslint/no-deprecated": "warn",

      // -----------------------------------------------------------------------
      // Style
      // -----------------------------------------------------------------------
      curly: ["error", "all"],
      eqeqeq: ["error", "always"],
      "no-else-return": ["error", { allowElseIf: false }],
      "object-shorthand": "error",
      "prefer-const": "error",
      "prefer-destructuring": ["error", { array: false, object: true }],
      "prefer-template": "error",

      // -----------------------------------------------------------------------
      // Complexity
      // -----------------------------------------------------------------------
      complexity: ["warn", 20],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 5],

      // -----------------------------------------------------------------------
      // Safety
      // -----------------------------------------------------------------------
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-debugger": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-return-assign": ["error", "always"]
    }
  },

  // ---------------------------------------------------------------------------
  // Tests
  // ---------------------------------------------------------------------------
  {
    name: "test-overrides",
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
    rules: {
      complexity: "off",
      "max-depth": "off",
      "max-params": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off"
    }
  },

  // ---------------------------------------------------------------------------
  // Declaration files
  // ---------------------------------------------------------------------------
  {
    name: "declaration-file-overrides",
    files: ["**/*.d.ts"],
    rules: {
      // Interface merging is required for augmenting global types like ProcessEnv
      "@typescript-eslint/consistent-type-definitions": "off"
    }
  },

  // ---------------------------------------------------------------------------
  // Scripts & Benchmarks
  // ---------------------------------------------------------------------------
  {
    name: "scripts-overrides",
    files: ["**/scripts/**/*.{ts,tsx}", "**/benchmarks/**/*.{ts,tsx}"],
    rules: {
      "no-console": "off"
    }
  },

  // ---------------------------------------------------------------------------
  // Prettier compatibility
  // ---------------------------------------------------------------------------
  {
    name: "prettier-compat",
    rules: {
      "arrow-body-style": "off",
      "prefer-arrow-callback": "off"
    }
  }
])
