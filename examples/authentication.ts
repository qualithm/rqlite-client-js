/**
 * Authentication example.
 *
 * Demonstrates connecting to a rqlite node that requires basic authentication.
 *
 * @example
 * ```bash
 * bun run examples/authentication.ts
 * ```
 */

/* eslint-disable no-console */

import { AuthenticationError, createRqliteClient } from "@qualithm/rqlite-client"

async function main(): Promise<void> {
  console.log("=== Authentication ===\n")

  // Connect with basic auth credentials
  console.log("--- Authenticated client ---")
  const client = createRqliteClient({
    host: "localhost:4001",
    auth: {
      username: "admin",
      password: "secret"
    }
  })

  const result = await client.query("SELECT 1 AS value")
  if (result.ok) {
    console.log("  Authenticated successfully")
    console.log("  Result:", result.value.values)
  } else {
    console.log("  Query failed:", result.error.message)
  }

  // Handle authentication errors
  console.log("\n--- Wrong credentials ---")
  const bad = createRqliteClient({
    host: "localhost:4001",
    auth: {
      username: "wrong",
      password: "credentials"
    }
  })

  const fail = await bad.query("SELECT 1")
  if (!fail.ok && AuthenticationError.isError(fail.error)) {
    console.log(`  Expected auth failure: ${fail.error.message}`)
  }

  // TLS connection
  console.log("\n--- TLS connection ---")
  const tlsClient = createRqliteClient({
    host: "rqlite.example.com:4001",
    tls: true,
    auth: {
      username: "admin",
      password: "secret"
    }
  })

  const tlsResult = await tlsClient.ready()
  if (tlsResult.ok) {
    console.log(`  Node ready: ${String(tlsResult.value.ready)}`)
  } else {
    console.log(`  Connection failed: ${tlsResult.error.message}`)
  }

  console.log("\nDone.")
}

void main()
