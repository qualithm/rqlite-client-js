# Examples

Runnable examples demonstrating rqlite client usage.

## Prerequisites

Start a local rqlite node (default: `localhost:4001`):

```bash
docker run -p 4001:4001 rqlite/rqlite
```

## Running Examples

```bash
bun run examples/basic-usage.ts
```

## Example Files

| File                                           | Description                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| [basic-usage.ts](basic-usage.ts)               | Connect, execute writes, and query reads                            |
| [batch-processing.ts](batch-processing.ts)     | Batch insert, batch query, and mixed requests                       |
| [transactions.ts](transactions.ts)             | Atomic multi-statement transactions                                 |
| [authentication.ts](authentication.ts)         | Basic auth credentials and TLS                                      |
| [cluster-failover.ts](cluster-failover.ts)     | Multi-host seeds, cluster discovery, leader redirect, health checks |
| [error-handling.ts](error-handling.ts)         | Result-based error handling and type narrowing                      |
| [pagination.ts](pagination.ts)                 | Paginated queries and toRows result conversion                      |
| [consistency-levels.ts](consistency-levels.ts) | Read consistency and freshness options                              |
| [client-lifecycle.ts](client-lifecycle.ts)     | Abort signals, destroy, and server version                          |
| [mtls.ts](mtls.ts)                             | Custom fetch injection for mTLS                                     |
