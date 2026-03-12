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
  readonly ok: true
  readonly value: T
}

/** Failed result containing an error. */
export type Err<E> = {
  readonly ok: false
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
