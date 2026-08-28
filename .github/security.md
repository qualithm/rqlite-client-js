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
