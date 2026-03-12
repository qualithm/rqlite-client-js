# CONTEXT.md

> **This is the single source of truth for this repository.** When CONTEXT.md conflicts with any
> other document, CONTEXT.md is correct.

---

## System Intent

Native rqlite client for JavaScript and TypeScript runtimes. Implements the rqlite HTTP API for
executing SQL statements, querying data, and managing cluster operations.

**Key capabilities:**

- SQL execution (writes) and queries (reads)
- Batch operations and transactions
- Parameterised queries with SQLite binding
- Consistency level control (none, weak, strong)
- Leader redirect handling
- Basic authentication
- Bun, Node.js, and Deno runtime support

**Scope:** Client-only; excludes rqlite server implementation, SQL parsing, ORM, connection pooling,
and SQLite internals.

---

## Current Reality

### Architecture

| Component | Technology             |
| --------- | ---------------------- |
| Language  | TypeScript (ESM-only)  |
| Runtime   | Bun, Node.js 20+, Deno |
| Build     | TypeScript compiler    |
| Test      | Vitest                 |
| Lint      | ESLint, Prettier       |
| Docs      | TypeDoc                |

### File Structure

| Directory   | Purpose                 |
| ----------- | ----------------------- |
| `bench/`    | Benchmarks with stats   |
| `examples/` | Runnable usage examples |
| `scripts/`  | Development utilities   |
| `src/`      | Source code             |

### Modules

| Name        | Purpose                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------- |
| `index.ts`  | Main entry point and public API re-exports                                                    |
| `result.ts` | `Result<T, E>` discriminated union with `ok`/`err` helpers                                    |
| `errors.ts` | Error hierarchy: `RqliteError`, `ConnectionError`, `QueryError`, `AuthenticationError`        |
| `types.ts`  | Domain types: config, SQL values, query/execute results, consistency levels                   |
| `client.ts` | `RqliteClient` class with fetch wrapper, timeout, auth, error mapping, leader redirect, retry |

### Features

| Feature            | Implementation                                           |
| ------------------ | -------------------------------------------------------- |
| Core types         | `Result<T, E>`, error hierarchy, config, SQL value types |
| HTTP client        | Native fetch, timeout, JSON serialisation                |
| Execute (writes)   | Single, batch, parameterised, queue/wait modes           |
| Query (reads)      | Single, batch, parameterised, associative format         |
| Unified request    | Mixed read/write via `/db/request`                       |
| Transactions       | `transaction` flag on execute and request batches        |
| Parameterised SQL  | Positional `?` placeholders with `SqlValue` binding      |
| Consistency levels | `none`, `weak`, `strong` with freshness options          |
| Leader redirect    | Automatic 301/307 following with configurable opt-out    |
| Retry with backoff | Exponential backoff, configurable max retries            |
| Authentication     | HTTP basic auth header generation                        |
| TLS                | HTTPS via native fetch                                   |
| Cluster status     | Status, readiness, node listing                          |
| API documentation  | TypeDoc with zero warnings                               |
| Examples           | Six runnable examples covering all major features        |

---

## Locked Decisions

1. **HTTP-based** — rqlite uses HTTP/HTTPS API; no binary protocol or gRPC
2. **Result types for errors** — Return `Result<T, E>` discriminated unions for operations that can
   fail; no exceptions in hot paths
3. **Factory functions** — Provide `createRqliteClient()` alongside class constructor
4. **Static error helpers** — Error classes include static `isError()` methods for type narrowing
5. **Explicit resource lifecycle** — User controls client lifecycle; no implicit reconnection or
   caching
6. **Zero runtime deps** — Bundle size, supply chain risk; use native fetch
7. **Spec compliance via fixtures** — Test against rqlite HTTP API spec; capture real responses as
   test fixtures

---

## Open Decisions & Risks

### Open Decisions

| ID   | Question                                   | Context                                                                |
| ---- | ------------------------------------------ | ---------------------------------------------------------------------- |
| OD-1 | Associative vs array result format default | rqlite supports both; associative is more ergonomic, arrays are faster |
| OD-2 | ~~Automatic leader discovery~~             | Resolved: follow redirects by default with configurable opt-out        |

### Risks

| ID  | Risk                             | Impact | Mitigation                                                       |
| --- | -------------------------------- | ------ | ---------------------------------------------------------------- |
| R-1 | rqlite API versioning            | Medium | Document tested rqlite versions; test against multiple versions  |
| R-2 | Leader election during requests  | Medium | Implement retry with backoff; document failure modes             |
| R-3 | Large result set memory pressure | Medium | Streaming support in future; document batch size recommendations |

---

## Work In Flight

> Claim work before starting. Include start timestamp. Remove within 24 hours of completion.

| ID  | Agent | Started | Task | Files |
| --- | ----- | ------- | ---- | ----- |

---

## Work Queue

### Core Types

- [x] Define `Result<T, E>` — shape: `{ ok: true; value: T }` | `{ ok: false; error: E }`
- [x] Define error hierarchy: `RqliteError` base, `ConnectionError`, `QueryError`,
      `AuthenticationError`
- [x] Error classes with static `isError()` helpers for type narrowing
- [x] Define `RqliteConfig` — host, port, auth, TLS options, timeout, consistency level defaults
- [x] Define `QueryResult` — columns, types, values, time, rows affected
- [x] Define `ExecuteResult` — last insert ID, rows affected, time
- [x] Define consistency levels: `none`, `weak`, `strong`
- [x] Define freshness options for stale reads

Acceptance: All types compile, unit tests verify `isError()` narrows correctly.

### HTTP Client Foundation

- [x] `RqliteClient` class with connection management
- [x] Factory function `createRqliteClient()`
- [x] Native fetch wrapper with timeout support
- [x] Request/response JSON serialisation
- [x] Basic authentication header generation
- [x] TLS/HTTPS support via native fetch
- [x] Error response parsing and mapping

Acceptance: Can connect to rqlite and receive status response; auth works; errors are typed.

### Execute Operations (Writes)

- [x] `execute(sql)` — single statement execution
- [x] `execute(sql, params)` — parameterised execution
- [x] `executeBatch(statements)` — multiple statements in one request
- [x] Transaction support via `transaction` flag
- [x] Queue mode support (write to leader queue)
- [x] Wait mode support (wait for write to be applied)
- [x] Parse `execute` response into `ExecuteResult`

Acceptance: Can INSERT/UPDATE/DELETE with params; batch operations work; transactions
commit/rollback correctly.

### Query Operations (Reads)

- [x] `query(sql)` — single query execution
- [x] `query(sql, params)` — parameterised query
- [x] `queryBatch(statements)` — multiple queries in one request
- [x] Consistency level option (none, weak, strong)
- [x] Freshness option for stale reads
- [x] Associative result format option
- [x] Parse `query` response into `QueryResult`

Acceptance: Can SELECT with params; consistency levels affect behaviour; results are correctly
typed.

### Unified Request API

- [x] `request(statements)` — unified read/write in single HTTP call
- [x] Automatic statement type detection (SELECT vs others)
- [x] Mixed read/write batch support
- [x] Transaction wrapping for request batches

Acceptance: Single API can handle mixed workloads; correctly routes to appropriate endpoint.

### Leader Handling

- [x] Detect leader redirect responses (HTTP 301/307)
- [x] Automatic redirect following option
- [x] Leader discovery via status endpoint
- [x] Retry logic with exponential backoff
- [x] Configurable max retries

Acceptance: Client follows leader changes transparently; retries recover from transient failures.

### Cluster Status

- [x] `status()` — get node status
- [x] `ready()` — check if node is ready
- [x] `nodes()` — list cluster nodes
- [x] Parse status response into typed structs

Acceptance: Can inspect cluster state; health checks work.

### Testing Infrastructure

- [x] Integration test harness with rqlite Docker container
- [x] HTTP response fixture capture and replay
- [x] Property-based tests for SQL parameterisation edge cases
- [x] Cross-runtime validation script (Bun, Node.js, Deno)

Acceptance: `bun test` runs unit tests; `bun test:integration` runs against real rqlite.

### Documentation & Examples

- [x] TypeDoc API documentation
- [x] Basic usage example (connect, query, execute)
- [x] Batch operations example
- [x] Transaction example
- [x] Authentication example
- [x] Cluster failover example
- [x] README with comprehensive usage guide

Acceptance: Complete API docs; runnable examples for all major features.

### Template Cleanup

- [x] Remove `src/greet.ts` and `src/__tests__/unit/greet.test.ts`
- [x] Update `bench/index.ts` to benchmark rqlite operations
- [x] Update `package.json` name, description, keywords, repository
- [x] Update `typedoc.json` with correct repository URL
- [x] Update `examples/` with rqlite-specific examples

Acceptance: No template references remain; package metadata is correct.

---

## Learnings

> Append-only. Never edit or delete existing entries.

| Date | Learning |
| ---- | -------- |
