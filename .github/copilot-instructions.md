# TypeScript Code Guidelines

## General

- Use TypeScript with strict mode
- British spelling in user-facing strings (e.g. "unauthorised", "colour")
- Lowercase error messages with no trailing punctuation
- Run linting and type checking before committing

## When Code Changes

Any code change should include review of:

- **Tests** - update existing tests, add new tests for new behaviour
- **Types** - update type definitions if data shapes change
- **Documentation** - update comments if public API changes
- **Error messages** - ensure they remain accurate and helpful
- **Configuration** - update env vars or config files if affected
- **Dependencies** - check for unused deps after removing code

Run before committing:

```bash
bun run lint
bun run typecheck
bun test
```

## Imports

**Order:** framework → external libs → workspace packages → local modules → types

```ts
import { useState, useCallback } from "react"

import { z } from "zod"

import { httpClient } from "@workspace/shared"

import { parseId, formatDate } from "../lib/utils"
import type { User, Session } from "../types"
```

**Rules:**

- Group imports by origin with blank lines between groups
- Use `import type { Y }` for type-only imports
- Use `import { x, type Y }` for mixed imports
- No duplicate imports
- Prefer explicit imports over `* as`

## Exports

- Prefer named exports over default exports
- Export types separately: `export type { MyType }`
- Group exports at the bottom of the file when re-exporting

## Types

- Prefer `type` over `interface` (enforced by ESLint)
- Use `unknown` over `any` where possible
- Document complex types with JSDoc comments

## Error Handling

- Use custom error classes for domain errors
- Include context in error messages
- Never swallow errors silently

## Testing

- Place tests in `__tests__` directories or as `.test.ts` files
- Use descriptive test names that explain the behaviour
- Test edge cases and error conditions
