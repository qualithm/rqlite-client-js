# Rqlite Client

[![CI](https://github.com/qualithm/rqlite-client-js/actions/workflows/ci.yaml/badge.svg)](https://github.com/qualithm/rqlite-client-js/actions/workflows/ci.yaml)
[![codecov](https://codecov.io/gh/qualithm/rqlite-client-js/graph/badge.svg)](https://codecov.io/gh/qualithm/rqlite-client-js)
[![npm](https://img.shields.io/npm/v/@qualithm/rqlite-client)](https://www.npmjs.com/package/@qualithm/rqlite-client)

Native [rqlite](https://rqlite.io) client for JavaScript and TypeScript runtimes. Zero runtime
dependencies — uses native `fetch`.

## Features

- **Execute & Query** — parameterised writes and reads
- **Batch operations** — multiple statements in a single HTTP call
- **Transactions** — atomic multi-statement execution
- **Unified requests** — mixed read/write batches via `/db/request`
- **Consistency levels** — `none`, `weak`, `strong`
- **Freshness control** — bounded staleness for `none` consistency reads
- **Leader redirect** — automatic 301/307 redirect following
- **Retry with backoff** — configurable exponential backoff
- **Authentication** — HTTP basic auth
- **TLS** — HTTPS support via native fetch
- **Cluster inspection** — node status, readiness, and cluster listing
- **Result types** — `Result<T, E>` discriminated unions, no thrown exceptions
- **Typed errors** — `ConnectionError`, `QueryError`, `AuthenticationError` with `isError()` guards
- **Zero dependencies** — uses native `fetch`
- **Cross-runtime** — Bun, Node.js 20+, Deno

## Installation

```bash
bun add @qualithm/rqlite-client
# or
npm install @qualithm/rqlite-client
```

## Quick Start

```ts
import { createRqliteClient } from "@qualithm/rqlite-client"

const client = createRqliteClient({ host: "localhost:4001" })

// Execute a write
await client.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")
await client.execute("INSERT INTO users(name) VALUES(?)", ["Alice"])

// Query
const result = await client.query("SELECT * FROM users")
if (result.ok) {
  console.log(result.value.columns) // ["id", "name"]
  console.log(result.value.values) // [[1, "Alice"]]
}
```

## Compatibility

| rqlite version | Client version | Status |
| -------------- | -------------- | ------ |
| 9.x            | 0.x            | Tested |

The integration test suite runs against rqlite via Docker. Override the version with the
`RQLITE_VERSION` environment variable:

```bash
RQLITE_VERSION=9.4.5 docker compose -f docker-compose.test.yml up -d
```

Use `serverVersion()` at runtime to check the connected server:

```ts
const ver = await client.serverVersion()
if (ver.ok) console.log(ver.value) // "v9.4.5"
```

## Usage

### Configuration

```ts
import { createRqliteClient } from "@qualithm/rqlite-client"

const client = createRqliteClient({
  host: "localhost:4001",
  tls: false, // use HTTPS
  auth: {
    // basic authentication
    username: "admin",
    password: "secret"
  },
  timeout: 10_000, // default request timeout (ms)
  consistencyLevel: "weak", // default for queries
  freshness: {
    // for "none" consistency
    freshness: "5s",
    freshnessStrict: true
  },
  followRedirects: true, // follow leader redirects
  maxRetries: 3, // retry attempts for transient failures
  maxRedirects: 5, // redirect attempts during leader election
  retryBaseDelay: 100 // backoff base delay (ms)
})
```

### Execute (Writes)

```ts
// Simple statement
const result = await client.execute("CREATE TABLE foo (id INTEGER PRIMARY KEY, name TEXT)")

// Parameterised statement
const insert = await client.execute("INSERT INTO foo(name) VALUES(?)", ["bar"])
if (insert.ok) {
  console.log(insert.value.lastInsertId) // 1
  console.log(insert.value.rowsAffected) // 1
}

// Batch execute
const batch = await client.executeBatch([
  ["INSERT INTO foo(name) VALUES(?)", "one"],
  ["INSERT INTO foo(name) VALUES(?)", "two"]
])

// Queue mode — returns immediately, write applied asynchronously
await client.execute("INSERT INTO foo(name) VALUES(?)", ["queued"], { queue: true })

// Wait mode — wait for queued write to be applied
await client.execute("INSERT INTO foo(name) VALUES(?)", ["waited"], { queue: true, wait: true })
```

### Query (Reads)

```ts
// Simple query
const result = await client.query("SELECT * FROM foo")
if (result.ok) {
  console.log(result.value.columns) // ["id", "name"]
  console.log(result.value.types) // ["integer", "text"]
  console.log(result.value.values) // [[1, "bar"], [2, "baz"]]
}

// Parameterised query
const row = await client.query("SELECT * FROM foo WHERE id = ?", [1])

// With consistency level
const strong = await client.query("SELECT * FROM foo", undefined, { level: "strong" })

// Freshness for stale reads
const fresh = await client.query("SELECT * FROM foo", undefined, {
  level: "none",
  freshness: { freshness: "1s", freshnessStrict: true }
})

// Batch query
const results = await client.queryBatch([
  ["SELECT * FROM foo WHERE id = ?", 1],
  ["SELECT COUNT(*) FROM foo"]
])
```

#### Converting to Row Objects

Query results use arrays by default (matching the rqlite wire format). Use `toRows()` to convert to
keyed objects when needed:

```ts
import { toRows } from "@qualithm/rqlite-client"

const result = await client.query("SELECT id, name FROM foo")
if (result.ok) {
  const rows = toRows(result.value) // [{ id: 1, name: "bar" }, ...]
}
```

#### Paginated Queries

Use `queryPaginated()` to iterate over large result sets in bounded-memory pages. It automatically
appends `LIMIT`/`OFFSET` to your SQL and yields pages via an async generator:

```ts
import { toRowsPaginated } from "@qualithm/rqlite-client"

for await (const page of client.queryPaginated("SELECT * FROM large_table", [], {
  pageSize: 100
})) {
  console.log(page.rows.values.length, page.hasMore, page.offset)

  // Or convert to keyed row objects:
  const { rows } = toRowsPaginated(page)
  // rows → [{ id: 1, name: "Alice" }, ...]
}
```

You can also start from a custom offset:

```ts
for await (const page of client.queryPaginated("SELECT * FROM large_table", [], {
  pageSize: 50,
  offset: 200
})) {
  // starts from row 200
}
```

### Transactions

```ts
// All statements succeed or all fail
const transfer = await client.executeBatch(
  [
    ["UPDATE accounts SET balance = balance - ? WHERE id = ?", 100, 1],
    ["UPDATE accounts SET balance = balance + ? WHERE id = ?", 100, 2]
  ],
  { transaction: true }
)
```

### Unified Request (Mixed Read/Write)

```ts
const results = await client.requestBatch([
  ["INSERT INTO foo(name) VALUES(?)", "new"],
  ["SELECT * FROM foo"]
])

if (results.ok) {
  for (const r of results.value) {
    if (r.type === "execute") console.log(r.rowsAffected)
    if (r.type === "query") console.log(r.columns, r.values)
  }
}
```

### Cluster Operations

```ts
// Node readiness
const ready = await client.ready()
if (ready.ok && ready.value.ready) {
  console.log("node is ready, leader:", ready.value.isLeader)
}

// Check readiness without requiring a leader (useful during elections)
await client.ready({ noleader: true })

// List cluster nodes
const nodes = await client.nodes()
if (nodes.ok) {
  for (const node of nodes.value) {
    console.log(node.id, node.leader ? "(leader)" : "", node.apiAddr)
  }
}

// Full node status
const status = await client.status()
```

### Error Handling

All operations return `Result<T, RqliteError>` — no exceptions are thrown in normal operation.

```ts
const result = await client.query("SELECT * FROM foo")

if (!result.ok) {
  const error = result.error

  // Type narrowing with static guards
  if (ConnectionError.isError(error)) {
    console.log("network issue:", error.message, error.url)
  } else if (QueryError.isError(error)) {
    console.log("SQL error:", error.message)
  } else if (AuthenticationError.isError(error)) {
    console.log("auth failed:", error.message)
  }
}
```

Errors can also be matched by their `tag` property:

```ts
if (!result.ok) {
  switch (result.error.tag) {
    case "ConnectionError": // network, timeout, redirect
    case "QueryError": // SQL errors from rqlite
    case "AuthenticationError": // 401/403
  }
}
```

## API Reference

Full API documentation is generated with [TypeDoc](https://typedoc.org/):

```bash
bun run docs
# Output in docs/
```

## Examples

See the [`examples/`](examples/) directory for runnable examples:

| Example                                               | Description                                    |
| ----------------------------------------------------- | ---------------------------------------------- |
| [`basic-usage.ts`](examples/basic-usage.ts)           | Connect, execute, and query                    |
| [`batch-processing.ts`](examples/batch-processing.ts) | Batch insert, query, and mixed requests        |
| [`transactions.ts`](examples/transactions.ts)         | Atomic multi-statement transactions            |
| [`authentication.ts`](examples/authentication.ts)     | Basic auth and TLS                             |
| [`cluster-failover.ts`](examples/cluster-failover.ts) | Leader redirect, health checks, cluster status |
| [`error-handling.ts`](examples/error-handling.ts)     | Result-based error handling and type narrowing |

```bash
bun run examples/basic-usage.ts
```

## Development

### Prerequisites

- [Bun](https://bun.sh/) (recommended), Node.js 20+, or [Deno](https://deno.land/)

### Setup

```bash
bun install
```

### Building

```bash
bun run build
```

### Testing

```bash
bun run test              # unit tests
bun run test:integration  # against a real rqlite instance
bun run test:coverage     # with coverage report
```

### Linting & Formatting

```bash
bun run lint
bun run format
bun run typecheck
```

### Benchmarks

```bash
bun run bench
```

## Publishing

The package is automatically published to NPM when CI passes on main. Update the version in
`package.json` before merging to trigger a new release.

## Licence

Apache-2.0
