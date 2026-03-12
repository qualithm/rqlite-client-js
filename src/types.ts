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
