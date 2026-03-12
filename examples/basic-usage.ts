/**
 * Basic usage example.
 *
 * Demonstrates the fundamental greet function usage patterns.
 *
 * @example
 * ```bash
 * bun run examples/basic-usage.ts
 * ```
 */

/* eslint-disable no-console */

import { greet, type GreetOptions } from "@qualithm/rqlite-client"

function main(): void {
  console.log("=== Basic Usage Examples ===\n")

  // Example 1: Simple informal greeting
  console.log("--- Example 1: Informal Greeting ---")
  const informal = greet({ name: "World" })
  console.log(`  Result: ${informal}`)
  console.log()

  // Example 2: Formal greeting
  console.log("--- Example 2: Formal Greeting ---")
  const formal = greet({ name: "Dr. Smith", formal: true })
  console.log(`  Result: ${formal}`)
  console.log()

  // Example 3: Using typed options
  console.log("--- Example 3: Typed Options ---")
  const options: GreetOptions = {
    name: "TypeScript Developer",
    formal: false
  }
  const typed = greet(options)
  console.log(`  Options: ${JSON.stringify(options)}`)
  console.log(`  Result: ${typed}`)
  console.log()

  // Example 4: Dynamic name
  console.log("--- Example 4: Dynamic Name ---")
  const names = ["Alice", "Bob", "Charlie"]
  for (const name of names) {
    console.log(`  ${name}: ${greet({ name })}`)
  }

  console.log("\nExamples complete.")
}

main()
