/**
 * Basic usage example — connect, execute, and query.
 *
 * Demonstrates creating a client, inserting data, and reading it back.
 *
 * @example
 * ```bash
 * bun run examples/basic-usage.ts
 * ```
 */

/* eslint-disable no-console */

import { createRqliteClient } from "@qualithm/rqlite-client"

async function main(): Promise<void> {
  console.log("=== Basic Usage ===\n")

  // Create a client connected to a local rqlite node
  const client = createRqliteClient({ host: "localhost:4001" })

  // Create a table
  console.log("--- Creating table ---")
  const create = await client.execute(
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)"
  )
  if (!create.ok) {
    console.error("failed to create table:", create.error.message)
    return
  }
  console.log("  Table created\n")

  // Insert a row with parameterised values
  console.log("--- Inserting row ---")
  const insert = await client.execute("INSERT INTO users(name, email) VALUES(?, ?)", [
    "Alice",
    "alice@example.com"
  ])
  if (!insert.ok) {
    console.error("failed to insert:", insert.error.message)
    return
  }
  console.log(`  Inserted row (id: ${String(insert.value.lastInsertId)})\n`)

  // Query the data back
  console.log("--- Querying rows ---")
  const query = await client.query("SELECT * FROM users")
  if (!query.ok) {
    console.error("failed to query:", query.error.message)
    return
  }

  console.log(`  Columns: ${query.value.columns.join(", ")}`)
  for (const row of query.value.values) {
    console.log(`  Row: ${row.join(", ")}`)
  }

  // Parameterised query
  console.log("\n--- Parameterised query ---")
  const find = await client.query("SELECT name, email FROM users WHERE name = ?", ["Alice"])
  if (find.ok) {
    console.log(`  Found ${String(find.value.values.length)} row(s)`)
  }

  console.log("\nDone.")
}

void main()
