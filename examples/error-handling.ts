/**
 * Error handling example.
 *
 * Demonstrates input validation and error handling patterns.
 *
 * @example
 * ```bash
 * bun run examples/error-handling.ts
 * ```
 */

/* eslint-disable no-console */

import { greet, type GreetOptions } from "../src/index"

/**
 * Validates greeting options before processing.
 * In a real library, you might throw custom errors.
 */
function validateOptions(options: unknown): options is GreetOptions {
  if (typeof options !== "object" || options === null) {
    return false
  }

  const obj = options as Record<string, unknown>

  if (typeof obj.name !== "string") {
    return false
  }

  if (obj.formal !== undefined && typeof obj.formal !== "boolean") {
    return false
  }

  return true
}

/**
 * Safe wrapper that validates input before greeting.
 */
function safeGreet(options: unknown): string {
  if (!validateOptions(options)) {
    throw new Error("Invalid options: expected { name: string, formal?: boolean }")
  }

  // Validate name is not empty
  if (options.name.trim() === "") {
    throw new Error("Name cannot be empty or whitespace-only")
  }

  return greet(options)
}

function main(): void {
  console.log("=== Error Handling Examples ===\n")

  // Example 1: Valid input
  console.log("--- Example 1: Valid Input ---")
  try {
    const result = safeGreet({ name: "Valid User" })
    console.log(`  Result: ${result}`)
  } catch (error) {
    console.log(`  Error: ${(error as Error).message}`)
  }
  console.log()

  // Example 2: Missing name property
  console.log("--- Example 2: Missing Name ---")
  try {
    const result = safeGreet({ formal: true })
    console.log(`  Result: ${result}`)
  } catch (error) {
    console.log(`  Error: ${(error as Error).message}`)
  }
  console.log()

  // Example 3: Empty name
  console.log("--- Example 3: Empty Name ---")
  try {
    const result = safeGreet({ name: "   " })
    console.log(`  Result: ${result}`)
  } catch (error) {
    console.log(`  Error: ${(error as Error).message}`)
  }
  console.log()

  // Example 4: Wrong type for formal
  console.log("--- Example 4: Invalid Formal Type ---")
  try {
    const result = safeGreet({ name: "Test", formal: "yes" })
    console.log(`  Result: ${result}`)
  } catch (error) {
    console.log(`  Error: ${(error as Error).message}`)
  }
  console.log()

  // Example 5: Null input
  console.log("--- Example 5: Null Input ---")
  try {
    const result = safeGreet(null)
    console.log(`  Result: ${result}`)
  } catch (error) {
    console.log(`  Error: ${(error as Error).message}`)
  }

  console.log("\nExamples complete.")
}

main()
