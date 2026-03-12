/**
 * Native rqlite client for JavaScript and TypeScript runtimes.
 *
 * @packageDocumentation
 */

// Result
export type { Err, Ok, Result } from "./result.js"
export { err, isErr, isOk, ok, toRows } from "./result.js"

// Errors
export { AuthenticationError, ConnectionError, QueryError, RqliteError } from "./errors.js"

// Client
export { createRqliteClient, RqliteClient } from "./client.js"

// Types
export type {
  ClusterNode,
  ConsistencyLevel,
  ExecuteOptions,
  ExecuteResult,
  FreshnessOptions,
  QueryOptions,
  QueryResult,
  ReadyResult,
  RequestOptions,
  RequestResult,
  RqliteAuth,
  RqliteConfig,
  SqlStatement,
  SqlValue,
  TaggedExecuteResult,
  TaggedQueryResult
} from "./types.js"
