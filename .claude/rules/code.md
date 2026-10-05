# TypeScript Library Guidelines

`bun run lint` enforces import order, type-only imports, naming and `type` over `interface`. Fix
what it flags; this file covers what it can't.

## Public API

- Named exports, never default exports. Export types separately (`export type { MyType }`) and group
  re-exports at the bottom of the file.
- `unknown` over `any`. Document complex types with JSDoc.
- Domain errors are custom error classes. Messages are lowercase, with no trailing punctuation, and
  carry context. Never swallow an error.

## Layout

- Tests use Vitest under `src/__tests__/unit/` (integration under `src/__tests__/integration/`),
  mirroring the source path. Name each test after the behavior it checks.
- `package.json` script variants use `:`, never `-`: `test:unit`, `test:integration`, `build:watch`,
  `lint:fix`.

## When code changes

A behavior change carries a test change. Update types, env vars, error messages and JSDoc that
mention a changed shape in the same change, and drop a dependency nothing imports any more.

## Comments

- JSDoc on exported functions: parameters, return value, `@throws`.
- Implementation comments only for non-obvious logic. No architecture overviews, diagrams, feature
  lists or how-to guides in comments; they go stale.

## Generated files

`.github/workflows/ci.yaml` is generated from `dx/ci-templates/`; change the template and run
`dx ci sync` from dx, never edit it here. `CI Required` is the single required status check.
