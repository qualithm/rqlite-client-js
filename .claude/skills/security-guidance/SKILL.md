---
name: security-guidance
description:
  "Security baseline for this repository: OWASP basics as they apply here and the audit-fix
  convention. Use for any security-sensitive change or security review."
---

# Security guidance

Baseline for any security-sensitive change or review in this repository.

- **Injection** — never interpolate untrusted input into shell commands, SQL, or HTML. Parameterise
  or escape at the boundary.
- **Secrets** — no secret in code, tests, fixtures, or example files. Secrets arrive as environment
  variables; `env-example` values stay empty.
- **Auth** — validate input at every trust boundary, including data from the frontend (a server-side
  handler treats its caller as untrusted).
- **Dependencies** — no new direct dependency without justification; prefer the standard
  library/runtime.

## Audit-fix convention

`bun audit` findings are fixed by editing `overrides` in package.json and running `bun install` —
never `bun add <pkg>` or `bun update <pkg>`, which write the package into `dependencies` and ship a
bogus runtime dep to consumers. When an advisory names a package already pinned in `overrides`, the
pin is usually the cause: bump the existing override, preferring the latest patch in the line. After
fixing, re-run `bun audit` and read the package.json diff — a clean audit is not proof the fix was
correct.

Never put a comment key (`"// pkg": "why"`) inside `overrides`: Bun ignores it, but npm reads every
key there as a package name and refuses to publish. Record why an override exists in the top-level
`"//overrides"` object instead, keyed by the same package name.

Published libraries ship zero `dependencies`; an override-only fix needs no release, but a change to
`dependencies`/`peerDependencies` does.
