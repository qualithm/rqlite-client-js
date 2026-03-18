/**
 * Batch processing example.
 *
 * Demonstrates executing and querying multiple statements in a single request.
 *
 * Requires a running rqlite node (`docker compose up -d`).
 *
 * @example
 * ```bash
 * bun run examples/batch-processing.ts
 * ```
 */

/* eslint-disable no-console */

import { createRqliteClient } from "@qualithm/rqlite-client"

async function main(): Promise<void> {
  console.log("=== Batch Processing ===\n")

  const client = createRqliteClient({ host: "localhost:4001" })

  // Set up table
  await client.execute(
    "CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT, price REAL)"
  )

  // Batch insert — multiple statements in a single HTTP call
  console.log("--- Batch insert ---")
  const insert = await client.executeBatch([
    ["INSERT INTO products(name, price) VALUES(?, ?)", "Widget", 9.99],
    ["INSERT INTO products(name, price) VALUES(?, ?)", "Gadget", 24.99],
    ["INSERT INTO products(name, price) VALUES(?, ?)", "Doohickey", 4.5]
  ])
  if (!insert.ok) {
    console.error("batch insert failed:", insert.error.message)
    return
  }
  console.log(`  Inserted ${String(insert.value.length)} rows`)
  for (const result of insert.value) {
    console.log(`    id=${String(result.lastInsertId)}, affected=${String(result.rowsAffected)}`)
  }

  // Batch query — multiple SELECTs in one request
  console.log("\n--- Batch query ---")
  const queries = await client.queryBatch([
    ["SELECT * FROM products WHERE price > ?", 10],
    ["SELECT COUNT(*) AS total FROM products"]
  ])
  if (!queries.ok) {
    console.error("batch query failed:", queries.error.message)
    return
  }

  console.log("  Expensive products:")
  for (const row of queries.value[0].values) {
    console.log(`    ${String(row[1])} — $${String(row[2])}`)
  }
  console.log(`  Total products: ${String(queries.value[1].values[0]?.[0])}`)

  // Mixed request — reads and writes in a single call
  console.log("\n--- Mixed request (read + write) ---")
  const mixed = await client.requestBatch([
    ["INSERT INTO products(name, price) VALUES(?, ?)", "Thingamajig", 14.99],
    ["SELECT name, price FROM products ORDER BY price DESC"]
  ])
  if (!mixed.ok) {
    console.error("mixed request failed:", mixed.error.message)
    return
  }

  for (const r of mixed.value) {
    if (r.type === "execute") {
      console.log(`  Write: ${String(r.rowsAffected)} row(s) affected`)
    }
    if (r.type === "query") {
      console.log(`  Query: ${String(r.values.length)} row(s) returned`)
      for (const row of r.values) {
        console.log(`    ${String(row[0])} — $${String(row[1])}`)
      }
    }
  }

  console.log("\nDone.")
}

main().catch(console.error)
