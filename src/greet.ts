/**
 * Options for the greet function.
 */
export type GreetOptions = {
  /** Name to greet. */
  name: string
  /** Whether to use formal greeting. */
  formal?: boolean
}

/**
 * Generate a greeting message.
 *
 * @param options - The greeting options.
 * @returns A greeting string.
 *
 * @example
 * ```ts
 * const message = greet({ name: "World" })
 * // => "Hello, World!"
 *
 * const formal = greet({ name: "World", formal: true })
 * // => "Good day, World."
 * ```
 */
export function greet(options: GreetOptions): string {
  const { name, formal = false } = options

  if (formal) {
    return `Good day, ${name}.`
  }

  return `Hello, ${name}!`
}
