/**
 * Core type definitions for the rqlite client.
 */

// =============================================================================
// Consistency & Freshness
// =============================================================================

/** Read consistency level for queries. */
export type ConsistencyLevel = "none" | "weak" | "strong"

/**
 * Freshness options for stale reads when using `none` consistency.
 *
 * The `freshness` value is a duration string (e.g. `"1s"`, `"5m"`) that
 * specifies the maximum staleness allowed for a read.
 */
export type FreshnessOptions = {
  /** Maximum staleness duration (e.g. `"1s"`, `"500ms"`, `"5m"`). */
  freshness: string
  /** When true, require the node to have received a heartbeat within the freshness window. */
  freshnessStrict?: boolean
}

// =============================================================================
// Configuration
// =============================================================================

/** Authentication credentials for rqlite. */
export type RqliteAuth = {
  /** Username for basic authentication. */
  username: string
  /** Password for basic authentication. */
  password: string
}

/** Configuration for the rqlite client. */
export type RqliteConfig = {
  /** Host and port of the rqlite node (e.g. `"localhost:4001"`). */
  host: string
  /** Use HTTPS instead of HTTP. */
  tls?: boolean
  /** Basic authentication credentials. */
  auth?: RqliteAuth
  /** Default request timeout in milliseconds. */
  timeout?: number
  /** Default consistency level for queries. */
  consistencyLevel?: ConsistencyLevel
  /** Default freshness options for stale reads. */
  freshness?: FreshnessOptions
  /** Automatically follow leader redirects (HTTP 301/307). Defaults to `true`. */
  followRedirects?: boolean
  /** Maximum number of retry attempts for transient failures. Defaults to `3`. */
  maxRetries?: number
  /** Maximum number of leader redirect attempts. Defaults to `5`. */
  maxRedirects?: number
  /** Base delay in milliseconds for exponential backoff between retries. Defaults to `100`. */
  retryBaseDelay?: number
}

// =============================================================================
// SQL Values
// =============================================================================

/** A value that can be bound to a parameterised SQL statement. */
export type SqlValue = string | number | boolean | null | Uint8Array

/** A parameterised SQL statement. */
export type SqlStatement = {
  /** The SQL string with `?` placeholders. */
  sql: string
  /** Positional parameter values. */
  params?: SqlValue[]
}

// =============================================================================
// Execute Options
// =============================================================================

/** Options for execute (write) operations. */
export type ExecuteOptions = {
  /** Wrap all statements in a transaction. */
  transaction?: boolean
  /** Queue the write on the leader (returns immediately). */
  queue?: boolean
  /** Wait for queued write to be applied before returning. */
  wait?: boolean
  /** Request timeout in milliseconds (overrides client default). */
  timeout?: number
  /** Abort signal to cancel the request. */
  signal?: AbortSignal
}

// =============================================================================
// Query Options
// =============================================================================

/** Options for query (read) operations. */
export type QueryOptions = {
  /** Read consistency level (overrides client default). */
  level?: ConsistencyLevel
  /** Freshness options for stale reads (only applies with `none` consistency). */
  freshness?: FreshnessOptions
  /** Return results as associative objects (column name → value) instead of arrays. */
  associative?: boolean
  /** Request timeout in milliseconds (overrides client default). */
  timeout?: number
  /** Abort signal to cancel the request. */
  signal?: AbortSignal
}

// =============================================================================
// Request Options
// =============================================================================

/** Options for unified request (mixed read/write) operations. */
export type RequestOptions = {
  /** Wrap all statements in a transaction. */
  transaction?: boolean
  /** Read consistency level (overrides client default). */
  level?: ConsistencyLevel
  /** Freshness options for stale reads (only applies with `none` consistency). */
  freshness?: FreshnessOptions
  /** Request timeout in milliseconds (overrides client default). */
  timeout?: number
  /** Abort signal to cancel the request. */
  signal?: AbortSignal
}

// =============================================================================
// Request Results
// =============================================================================

/** A query result tagged with `type: "query"` for use in mixed request responses. */
export type TaggedQueryResult = {
  /** Discriminant — always `"query"` for SELECT results. */
  type: "query"
} & QueryResult

/** An execute result tagged with `type: "execute"` for use in mixed request responses. */
export type TaggedExecuteResult = {
  /** Discriminant — always `"execute"` for write results. */
  type: "execute"
} & ExecuteResult

/** A single result from the unified request endpoint — either a query or execute result. */
export type RequestResult = TaggedQueryResult | TaggedExecuteResult

// =============================================================================
// Query Results
// =============================================================================

/**
 * Result of a query (SELECT) operation.
 *
 * Contains column metadata and rows of values.
 */
export type QueryResult = {
  /** Column names in the result set. */
  columns: string[]
  /** Column types as reported by SQLite. */
  types: string[]
  /** Row data as arrays of values (one per row). */
  values: SqlValue[][]
  /** Server-reported execution time in seconds. */
  time: number
}

/**
 * Result of an execute (INSERT/UPDATE/DELETE) operation.
 */
export type ExecuteResult = {
  /** Last inserted row ID, if applicable. */
  lastInsertId: number
  /** Number of rows affected by the operation. */
  rowsAffected: number
  /** Server-reported execution time in seconds. */
  time: number
}

// =============================================================================
// Pagination
// =============================================================================

/** Options for paginated queries. */
export type PaginationOptions = {
  /** Number of rows per page. */
  pageSize: number
  /** Starting row offset (defaults to `0`). */
  offset?: number
}

/** A single page of query results. */
export type PageResult<T> = {
  /** The rows for this page. */
  rows: T
  /** The offset of this page (0-based). */
  offset: number
  /** Whether more pages are available after this one. */
  hasMore: boolean
  /** The page size used for this query. */
  pageSize: number
}

// =============================================================================
// Cluster Status
// =============================================================================

/** A node in the rqlite cluster as returned by the `/nodes` endpoint. */
export type ClusterNode = {
  /** Raft node ID. */
  id: string
  /** HTTP API address (e.g. `"http://localhost:4001"`). */
  apiAddr: string
  /** Raft communication address (e.g. `"localhost:4002"`). */
  addr: string
  /** Whether this node is the current leader. */
  leader: boolean
  /** Whether this node is reachable. */
  reachable: boolean
  /** Round-trip time to this node in seconds, if available. */
  time?: number
}

/** Readiness check result from the `/readyz` endpoint. */
export type ReadyResult = {
  /** Whether the node is ready to accept requests. */
  ready: boolean
  /** Whether the node is the leader. */
  isLeader: boolean
}
