/**
 * Consistency levels example.
 *
 * Demonstrates read consistency control: `none`, `weak`, and `strong` levels,
 * plus freshness options for stale reads.
 *
 * @example
 * ```bash
 * bun run examples/consistency-levels.ts
 * ```
 */

/* eslint-disable no-console */

import { createRqliteClient } from "@qualithm/rqlite-client"

async function main(): Promise<void> {
  console.log("=== Consistency Levels ===\n")

  // Default consistency can be set at client level
  const client = createRqliteClient({
    host: "localhost:4001",
    consistencyLevel: "weak"
  })

  await client.execute(
    "CREATE TABLE IF NOT EXISTS readings (id INTEGER PRIMARY KEY, value REAL, ts TEXT)"
  )
  await client.execute("INSERT INTO readings(value, ts) VALUES(?, ?)", [
    42.5,
    "2026-03-13T10:00:00"
  ])

  // --- None: reads from local node, fastest but potentially stale ---
  console.log("--- None consistency (local read) ---")
  const none = await client.query("SELECT * FROM readings", undefined, { level: "none" })
  if (none.ok) {
    console.log(`  Rows: ${String(none.value.values.length)}, time: ${String(none.value.time)}s`)
  }

  // --- Weak: reads from leader (default for most deployments) ---
  console.log("\n--- Weak consistency (leader read) ---")
  const weak = await client.query("SELECT * FROM readings", undefined, { level: "weak" })
  if (weak.ok) {
    console.log(`  Rows: ${String(weak.value.values.length)}, time: ${String(weak.value.time)}s`)
  }

  // --- Strong: linearisable read, involves Raft consensus ---
  console.log("\n--- Strong consistency (linearisable read) ---")
  const strong = await client.query("SELECT * FROM readings", undefined, { level: "strong" })
  if (strong.ok) {
    console.log(
      `  Rows: ${String(strong.value.values.length)}, time: ${String(strong.value.time)}s`
    )
  }

  // --- Freshness: bounded staleness for none-consistency reads ---
  console.log("\n--- Freshness control ---")
  const fresh = await client.query("SELECT * FROM readings", undefined, {
    level: "none",
    freshness: { freshness: "5s", freshnessStrict: true }
  })
  if (fresh.ok) {
    console.log(`  Fresh read rows: ${String(fresh.value.values.length)}`)
  } else {
    console.log(`  Freshness requirement not met: ${fresh.error.message}`)
  }

  // --- Default consistency from client config ---
  console.log("\n--- Default consistency (from client config: weak) ---")
  const defaultRead = await client.query("SELECT * FROM readings")
  if (defaultRead.ok) {
    console.log(`  Rows: ${String(defaultRead.value.values.length)}`)
  }

  console.log("\nDone.")
}

void main()
