---
description: "Runtime conventions for errors, logs, settings and CLIs"
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Runtime Conventions

One set of rules for errors, logs, settings and CLIs holds in every language, so logs and errors
from different repos read and search together. This is how they look here.

## Errors

- Errors are `Error` subclasses under one base per package (`<Component>Error`), thrown across the
  public API. Messages are lowercase, with no trailing punctuation, and name what failed
  (`claim code expired`).
- Inside the package, an expected outcome the caller must branch on may be a
  `{ ok: true, … } | { ok: false, reason }` union; never export one. Never signal failure with
  `null`, `undefined` or a success-shaped value.

## Logging

- Library code never writes to stdout or stderr and adds no log handlers. Where it logs, it takes
  the caller's logger.
- A log line is an `event` (a `snake_case` name) plus fields, never a sentence with values
  interpolated.
- Field keys are `snake_case` in every language, so one query reads every service. The shared names
  are `team_id`, `device_id`, `request_id`, `trace_id`, `duration_ms`, and `error` for the error,
  never `e` or `err`.

## Settings

- Options are a `<Component>Config` type whose defaults are production values.
- Units go in names: `_ms` for durations and `_bytes` for sizes, in config fields and env vars
  (`POLL_INTERVAL_MS`). Keep an existing `_SECS` or `_SECONDS` name: renaming a deployed variable
  gains nothing.
- Env var prefix: software that runs on a builder's machine or device (a CLI, an SDK) uses
  `QUALITHM_`; a service uses its own name (`VARV_`) or none. Standard names (`PORT`, `LOG_LEVEL`)
  stay unprefixed, and credentials keep their own naming rule.

## CLIs

A binary the package ships catches errors once, at its entry point, and follows this contract:

- Exit `0` on success, `1` on a failure or a problem found, `2` on invalid usage. Codes from `3` up
  are allowed, each mapped one-to-one from an error code in the `--json` envelope.
- `--json` prints one envelope line, `{ok, code?, message?, dryRun?, data?}`. Its `code` values are
  stable, because agents branch on them.
- Every command that changes something takes `--dry-run`, and a dry run exits `0`.
- Without `--json`, errors go to stderr as `<binary>: <message>`.
