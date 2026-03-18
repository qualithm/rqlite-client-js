/**
 * Client lifecycle example.
 *
 * Demonstrates `destroy()` for cleanup, `AbortSignal` for request cancellation,
 * and `serverVersion()` for runtime version checks.
 *
 * Requires a running rqlite node (`docker compose up -d`).
 *
 * @example
 * ```bash
 * bun run examples/client-lifecycle.ts
 * ```
 */

/* eslint-disable no-console */

import { createRqliteClient } from "@qualithm/rqlite-client"

async function main(): Promise<void> {
  console.log("=== Client Lifecycle ===\n")

  const client = createRqliteClient({ host: "localhost:4001" })

  // --- Server version ---
  console.log("--- Server version ---")
  const version = await client.serverVersion()
  if (version.ok) {
    console.log(`  rqlite version: ${version.value ?? "unknown"}`)
  } else {
    console.log(`  Failed to get version: ${version.error.message}`)
  }

  // --- AbortSignal: cancel a request ---
  console.log("\n--- Abort signal ---")
  const controller = new AbortController()

  // Abort after 50ms to demonstrate cancellation
  setTimeout(() => {
    controller.abort()
  }, 50)

  const aborted = await client.query("SELECT 1", undefined, { signal: controller.signal })
  if (aborted.ok) {
    console.log("  Query completed before abort")
  } else {
    console.log(`  Request cancelled: ${aborted.error.message}`)
  }

  // --- Timeout: per-request timeout override ---
  console.log("\n--- Per-request timeout ---")
  const quick = await client.query("SELECT 1", undefined, { timeout: 5000 })
  if (quick.ok) {
    console.log(`  Query completed within timeout (time: ${String(quick.value.time)}s)`)
  }

  // --- destroy(): clean up the client ---
  console.log("\n--- Client destroy ---")
  console.log(`  Destroyed before: ${String(client.destroyed)}`)
  client.destroy()
  console.log(`  Destroyed after: ${String(client.destroyed)}`)

  // All subsequent requests fail immediately
  const afterDestroy = await client.query("SELECT 1")
  if (!afterDestroy.ok) {
    console.log(`  Post-destroy request failed: ${afterDestroy.error.message}`)
  }

  console.log("\nDone.")
}

main().catch(console.error)
