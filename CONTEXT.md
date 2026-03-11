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

| Name       | Purpose          |
| ---------- | ---------------- |
| `index.ts` | Main entry point |
| `greet.ts` | Greeting utility |

### Features

| Feature            | Status      | Notes |
| ------------------ | ----------- | ----- |
| Core types         | Not started |       |
| HTTP client        | Not started |       |
| Execute (writes)   | Not started |       |
| Query (reads)      | Not started |       |
| Batch operations   | Not started |       |
| Transactions       | Not started |       |
| Parameterised SQL  | Not started |       |
| Consistency levels | Not started |       |
| Leader redirect    | Not started |       |
| Authentication     | Not started |       |
| Cluster status     | Not started |       |
| Cross-runtime      | Not started |       |

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
| OD-2 | Automatic leader discovery                 | Follow redirects automatically vs return redirect info to caller       |

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

- [ ] Define `Result<T, E>` — shape: `{ ok: true; value: T }` | `{ ok: false; error: E }`
- [ ] Define error hierarchy: `RqliteError` base, `ConnectionError`, `QueryError`,
      `AuthenticationError`
- [ ] Error classes with static `isError()` helpers for type narrowing
- [ ] Define `RqliteConfig` — host, port, auth, TLS options, timeout, consistency level defaults
- [ ] Define `QueryResult` — columns, types, values, time, rows affected
- [ ] Define `ExecuteResult` — last insert ID, rows affected, time
- [ ] Define consistency levels: `none`, `weak`, `strong`
- [ ] Define freshness options for stale reads

Acceptance: All types compile, unit tests verify `isError()` narrows correctly.

### HTTP Client Foundation

- [ ] `RqliteClient` class with connection management
- [ ] Factory function `createRqliteClient()`
- [ ] Native fetch wrapper with timeout support
- [ ] Request/response JSON serialisation
- [ ] Basic authentication header generation
- [ ] TLS/HTTPS support via native fetch
- [ ] Error response parsing and mapping

Acceptance: Can connect to rqlite and receive status response; auth works; errors are typed.

### Execute Operations (Writes)

- [ ] `execute(sql)` — single statement execution
- [ ] `execute(sql, params)` — parameterised execution
- [ ] `executeBatch(statements)` — multiple statements in one request
- [ ] Transaction support via `transaction` flag
- [ ] Queue mode support (write to leader queue)
- [ ] Wait mode support (wait for write to be applied)
- [ ] Parse `execute` response into `ExecuteResult`

Acceptance: Can INSERT/UPDATE/DELETE with params; batch operations work; transactions
commit/rollback correctly.

### Query Operations (Reads)

- [ ] `query(sql)` — single query execution
- [ ] `query(sql, params)` — parameterised query
- [ ] `queryBatch(statements)` — multiple queries in one request
- [ ] Consistency level option (none, weak, strong)
- [ ] Freshness option for stale reads
- [ ] Associative result format option
- [ ] Parse `query` response into `QueryResult`

Acceptance: Can SELECT with params; consistency levels affect behaviour; results are correctly
typed.

### Unified Request API

- [ ] `request(statements)` — unified read/write in single HTTP call
- [ ] Automatic statement type detection (SELECT vs others)
- [ ] Mixed read/write batch support
- [ ] Transaction wrapping for request batches

Acceptance: Single API can handle mixed workloads; correctly routes to appropriate endpoint.

### Leader Handling

- [ ] Detect leader redirect responses (HTTP 301/307)
- [ ] Automatic redirect following option
- [ ] Leader discovery via status endpoint
- [ ] Retry logic with exponential backoff
- [ ] Configurable max retries

Acceptance: Client follows leader changes transparently; retries recover from transient failures.

### Cluster Status

- [ ] `status()` — get node status
- [ ] `ready()` — check if node is ready
- [ ] `nodes()` — list cluster nodes
- [ ] Parse status response into typed structs

Acceptance: Can inspect cluster state; health checks work.

### Testing Infrastructure

- [ ] Integration test harness with rqlite Docker container
- [ ] HTTP response fixture capture and replay
- [ ] Property-based tests for SQL parameterisation edge cases
- [ ] Cross-runtime validation script (Bun, Node.js, Deno)

Acceptance: `bun test` runs unit tests; `bun test:integration` runs against real rqlite.

### Documentation & Examples

- [ ] TypeDoc API documentation
- [ ] Basic usage example (connect, query, execute)
- [ ] Batch operations example
- [ ] Transaction example
- [ ] Authentication example
- [ ] Cluster failover example
- [ ] README with comprehensive usage guide

Acceptance: Complete API docs; runnable examples for all major features.

### Template Cleanup

- [ ] Remove `src/greet.ts` and `src/__tests__/unit/greet.test.ts`
- [ ] Update `bench/index.ts` to benchmark rqlite operations
- [ ] Update `package.json` name, description, keywords, repository
- [ ] Update `typedoc.json` with correct repository URL
- [ ] Update `examples/` with rqlite-specific examples

Acceptance: No template references remain; package metadata is correct.

---

## Learnings

> Append-only. Never edit or delete existing entries.

| Date | Learning |
| ---- | -------- |
