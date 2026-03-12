/**
 * Native rqlite client for JavaScript and TypeScript runtimes.
 *
 * @packageDocumentation
 */

// Legacy — to be removed
export type { GreetOptions } from "./greet.js"
export { greet } from "./greet.js"

// Result
export type { Err, Ok, Result } from "./result.js"
export { err, isErr, isOk, ok } from "./result.js"

// Errors
export { AuthenticationError, ConnectionError, QueryError, RqliteError } from "./errors.js"

// Client
export { createRqliteClient, RqliteClient } from "./client.js"

// Types
export type {
  ConsistencyLevel,
  ExecuteOptions,
  ExecuteResult,
  FreshnessOptions,
  QueryOptions,
  QueryResult,
  RqliteAuth,
  RqliteConfig,
  SqlStatement,
  SqlValue
} from "./types.js"
