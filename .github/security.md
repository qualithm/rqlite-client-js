# Security guidance

Baseline for any security-sensitive change or review in this repository.

## OWASP basics, as they apply here

- **Injection** — never interpolate untrusted input into shell commands, SQL, or HTML. Parameterise
  or escape at the boundary.
- **Secrets** — no secret in code, tests, fixtures, or example files. Secrets live in Infisical and
  arrive as env vars; `env-example` values stay empty.
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

Published libraries ship zero `dependencies`; an override-only fix needs no release, but a change to
`dependencies`/`peerDependencies` does.
