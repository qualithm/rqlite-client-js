/**
 * Error hierarchy for rqlite client operations.
 *
 * All errors extend {@link RqliteError}. Use the static `isError()` method
 * on each class for type narrowing without `instanceof`.
 *
 * @example
 * ```ts
 * if (RqliteError.isError(err)) {
 *   // err is RqliteError
 * }
 * if (ConnectionError.isError(err)) {
 *   // err is ConnectionError
 * }
 * ```
 */

const RQLITE_ERROR_TAG = "RqliteError" as const
const CONNECTION_ERROR_TAG = "ConnectionError" as const
const QUERY_ERROR_TAG = "QueryError" as const
const AUTHENTICATION_ERROR_TAG = "AuthenticationError" as const

/** Base error for all rqlite client errors. */
export class RqliteError extends Error {
  readonly tag: string = RQLITE_ERROR_TAG

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "RqliteError"
  }

  /** Type-narrowing check for any RqliteError. */
  static isError(value: unknown): value is RqliteError {
    return value instanceof RqliteError
  }
}

/** Error connecting to the rqlite cluster. */
export class ConnectionError extends RqliteError {
  override readonly tag = CONNECTION_ERROR_TAG

  /** The URL that was being connected to, if available. */
  readonly url: string | undefined

  constructor(message: string, options?: ErrorOptions & { url?: string }) {
    super(message, options)
    this.name = "ConnectionError"
    this.url = options?.url
  }

  /** Type-narrowing check for ConnectionError. */
  static override isError(value: unknown): value is ConnectionError {
    return value instanceof ConnectionError
  }
}

/** Error returned by rqlite for a query or execute operation. */
export class QueryError extends RqliteError {
  override readonly tag = QUERY_ERROR_TAG

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "QueryError"
  }

  /** Type-narrowing check for QueryError. */
  static override isError(value: unknown): value is QueryError {
    return value instanceof QueryError
  }
}

/** Error when authentication fails against rqlite. */
export class AuthenticationError extends RqliteError {
  override readonly tag = AUTHENTICATION_ERROR_TAG

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "AuthenticationError"
  }

  /** Type-narrowing check for AuthenticationError. */
  static override isError(value: unknown): value is AuthenticationError {
    return value instanceof AuthenticationError
  }
}
