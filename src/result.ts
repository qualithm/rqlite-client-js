/**
 * Discriminated union for operations that can fail.
 *
 * Use {@link ok} and {@link err} helpers to construct values.
 *
 * @example
 * ```ts
 * const success: Result<number, Error> = ok(42)
 * const failure: Result<number, Error> = err(new Error("failed"))
 *
 * if (success.ok) {
 *   console.log(success.value) // 42
 * } else {
 *   console.log(success.error)
 * }
 * ```
 */
export type Result<T, E> = Ok<T> | Err<E>

/** Successful result containing a value. */
export type Ok<T> = {
  /** Discriminant — always `true` for a successful result. */
  readonly ok: true
  /** The success value. */
  readonly value: T
}

/** Failed result containing an error. */
export type Err<E> = {
  /** Discriminant — always `false` for a failed result. */
  readonly ok: false
  /** The error value. */
  readonly error: E
}

/** Create a successful result. */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value }
}

/** Create a failed result. */
export function err<E>(error: E): Err<E> {
  return { ok: false, error }
}

/** Check whether a result is successful. */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok
}

/** Check whether a result is a failure. */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok
}

/**
 * Convert a {@link QueryResult} (array format) into an array of row objects.
 *
 * Each row is a `Record<string, SqlValue>` keyed by column name.
 *
 * @example
 * ```ts
 * const result = await client.query("SELECT id, name FROM users")
 * if (result.ok) {
 *   const rows = toRows(result.value)
 *   // [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }]
 * }
 * ```
 */
export function toRows(result: {
  columns: string[]
  values: unknown[][]
}): Record<string, unknown>[] {
  const { columns, values } = result
  return values.map((row) => {
    const obj: Record<string, unknown> = {}
    for (let i = 0; i < columns.length; i++) {
      obj[columns[i]] = row[i]
    }
    return obj
  })
}
