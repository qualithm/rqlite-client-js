# CONTEXT.md

> **Single source of truth.** CONTEXT.md > Code > README > Comments.

---

## System Intent

Native rqlite client for JavaScript and TypeScript runtimes. Implements the rqlite HTTP API for
executing SQL statements, querying data, and managing cluster operations.

**Key capabilities:**

- SQL execution (writes) and queries (reads)
- Batch operations and transactions
- Parameterised queries with SQLite binding
- Consistency level control (none, weak, strong)
- Leader redirect handling- Cluster peer discovery and multi-host seed bootstrapping- Basic
  authentication
- Bun, Node.js, and Deno runtime support

**Scope:** Client library only; excludes rqlite server implementation, SQL parsing, ORM, connection
pooling, and SQLite internals.

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

### Modules

| Module      | Purpose                                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| `index.ts`  | Main entry point and public API re-exports                                                                           |
| `result.ts` | `Result<T, E>` discriminated union with `ok`/`err` helpers                                                           |
| `errors.ts` | Error hierarchy: `RqliteError`, `ConnectionError`, `QueryError`, `AuthenticationError`                               |
| `types.ts`  | Domain types: config, SQL values, query/execute results, consistency levels                                          |
| `client.ts` | `RqliteClient` class with fetch wrapper, timeout, auth, error mapping, leader redirect, retry, abort signal, destroy |

### Features

| Feature            | Notes                                                                         |
| ------------------ | ----------------------------------------------------------------------------- |
| Core types         | `Result<T, E>`, error hierarchy, config, SQL value types                      |
| HTTP client        | Native fetch, timeout, JSON serialisation                                     |
| Execute (writes)   | Single, batch, parameterised, queue/wait modes                                |
| Query (reads)      | Single, batch, parameterised, associative format                              |
| Result conversion  | `toRows()` utility converts array results to keyed row objects                |
| Pagination         | `queryPaginated()` async generator with `LIMIT`/`OFFSET`, `toRowsPaginated()` |
| Unified request    | Mixed read/write via `/db/request`                                            |
| Transactions       | `transaction` flag on execute and request batches                             |
| Parameterised SQL  | Positional `?` placeholders with `SqlValue` binding                           |
| Consistency levels | `none`, `weak`, `strong` with freshness options                               |
| Leader redirect    | Automatic 301/307 following with separate redirect budget                     |
| Cluster discovery  | Background `/nodes` refresh after first success; peer rotation on failure     |
| Multi-host seeds   | `hosts` config option seeds initial peer pool alongside primary `host`        |
| Retry with backoff | Jittered exponential backoff, separate retry and redirect budgets             |
| Authentication     | HTTP basic auth with UTF-8-safe encoding                                      |
| TLS                | HTTPS via native fetch                                                        |
| Custom fetch       | Optional `fetch` injection for mTLS and advanced transport                    |
| Cluster status     | Status, readiness, node listing, server version                               |
| Abort signal       | User-supplied `AbortSignal` threaded through all operations                   |
| Redirect safety    | URL scheme validation on leader redirects (SSRF mitigation)                   |
| Client lifecycle   | `destroy()` method aborts in-flight requests and prevents new ones            |
| API documentation  | TypeDoc with zero warnings                                                    |
| Examples           | Ten runnable examples covering all major features                             |

### File Structure

| Directory   | Purpose                 |
| ----------- | ----------------------- |
| `bench/`    | Benchmarks with stats   |
| `examples/` | Runnable usage examples |
| `scripts/`  | Development utilities   |
| `src/`      | Source code             |

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
8. **Array result format** — Arrays as default (wire format alignment); `toRows()` for object
   conversion
9. **Auto-follow leader redirects** — Follow 301/307 by default with configurable opt-out

---

## Open Decisions & Risks

### Open Decisions

| ID  | Question | Context |
| --- | -------- | ------- |

### Risks

| ID  | Risk                             | Impact | Mitigation                                                                                              |
| --- | -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| R-1 | rqlite API versioning            | Medium | `serverVersion()` method; README compatibility table; docker-compose version env var                    |
| R-2 | Leader election during requests  | Medium | Jittered exponential backoff; separate redirect and retry budgets; `maxRedirects` opt                   |
| R-3 | Large result set memory pressure | Medium | `queryPaginated()` async generator fetches in bounded-memory pages; document batch size recommendations |

---

## Work In Flight

> Claim work before starting. Include start timestamp. Remove within 24 hours of completion.

| ID  | Agent | Started | Task | Files |
| --- | ----- | ------- | ---- | ----- |

---

## Work Queue

No items.
