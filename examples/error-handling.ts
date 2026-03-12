/**
 * Error handling example.
 *
 * Demonstrates Result-based error handling and typed error narrowing.
 *
 * @example
 * ```bash
 * bun run examples/error-handling.ts
 * ```
 */

/* eslint-disable no-console */

import {
  AuthenticationError,
  ConnectionError,
  createRqliteClient,
  QueryError,
  RqliteError
} from "@qualithm/rqlite-client"

async function main(): Promise<void> {
  console.log("=== Error Handling ===\n")

  // All operations return Result<T, RqliteError> — no exceptions thrown
  const client = createRqliteClient({ host: "localhost:4001" })

  // Example 1: Basic Result checking
  console.log("--- Result checking ---")
  const result = await client.query("SELECT 1")
  if (result.ok) {
    console.log("  Query succeeded:", result.value.values)
  } else {
    console.log("  Query failed:", result.error.message)
  }

  // Example 2: Type narrowing with static isError() methods
  console.log("\n--- Error type narrowing ---")
  const bad = await client.execute("INVALID SQL STATEMENT")
  if (!bad.ok) {
    const { error } = bad

    if (ConnectionError.isError(error)) {
      console.log(`  Connection error: ${error.message}`)
      console.log(`  URL: ${error.url ?? "unknown"}`)
    } else if (QueryError.isError(error)) {
      console.log(`  SQL error: ${error.message}`)
    } else if (AuthenticationError.isError(error)) {
      console.log(`  Auth error: ${error.message}`)
    } else if (RqliteError.isError(error)) {
      console.log(`  General rqlite error: ${error.message}`)
    }
  }

  // Example 3: Handling connection failures gracefully
  console.log("\n--- Connection failure ---")
  const offline = createRqliteClient({ host: "localhost:9999", timeout: 2000, maxRetries: 0 })
  const fail = await offline.query("SELECT 1")
  if (!fail.ok) {
    console.log(`  Expected failure: ${fail.error.message}`)
    console.log(`  Error class: ${fail.error.constructor.name}`)
  }

  // Example 4: Discriminant tag matching
  console.log("\n--- Tag-based matching ---")
  const tagResult = await client.execute("DROP TABLE nonexistent_table")
  if (!tagResult.ok) {
    switch (tagResult.error.tag) {
      case "ConnectionError":
        console.log("  Network issue")
        break
      case "QueryError":
        console.log("  SQL issue")
        break
      case "AuthenticationError":
        console.log("  Auth issue")
        break
      default:
        console.log("  Unknown error")
    }
  }

  console.log("\nDone.")
}

void main()
