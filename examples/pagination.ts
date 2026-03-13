/**
 * Pagination and result conversion example.
 *
 * Demonstrates `queryPaginated()` for bounded-memory iteration over large
 * result sets, and `toRows()` / `toRowsPaginated()` for converting array
 * results into keyed row objects.
 *
 * @example
 * ```bash
 * bun run examples/pagination.ts
 * ```
 */

/* eslint-disable no-console */

import { createRqliteClient, toRows, toRowsPaginated } from "@qualithm/rqlite-client"

async function main(): Promise<void> {
  console.log("=== Pagination & Result Conversion ===\n")

  const client = createRqliteClient({ host: "localhost:4001" })

  // Set up table with sample data
  await client.execute(
    "CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT, category TEXT)"
  )
  await client.executeBatch(
    Array.from({ length: 25 }, (_, i) => [
      "INSERT OR REPLACE INTO items(id, name, category) VALUES(?, ?, ?)",
      i + 1,
      `Item ${String(i + 1)}`,
      i % 2 === 0 ? "A" : "B"
    ])
  )

  // --- toRows: convert array results to row objects ---
  console.log("--- toRows ---")
  const result = await client.query("SELECT id, name, category FROM items LIMIT 5")
  if (result.ok) {
    const rows = toRows(result.value)
    for (const row of rows) {
      console.log(`  ${String(row.id)}: ${String(row.name)} (${String(row.category)})`)
    }
  }

  // --- queryPaginated: iterate through pages ---
  console.log("\n--- queryPaginated ---")
  let pageNumber = 0
  for await (const page of client.queryPaginated("SELECT id, name FROM items ORDER BY id", [], {
    pageSize: 10
  })) {
    pageNumber++
    console.log(
      `  Page ${String(pageNumber)}: ${String(page.rows.values.length)} rows (offset=${String(page.offset)}, hasMore=${String(page.hasMore)})`
    )
  }
  console.log(`  Total pages: ${String(pageNumber)}`)

  // --- toRowsPaginated: convert paginated results to row objects ---
  console.log("\n--- toRowsPaginated ---")
  for await (const page of client.queryPaginated(
    "SELECT id, name, category FROM items ORDER BY id",
    [],
    { pageSize: 10 }
  )) {
    const converted = toRowsPaginated(page)
    console.log(
      `  Page at offset ${String(converted.offset)} (hasMore=${String(converted.hasMore)}):`
    )
    for (const row of converted.rows) {
      console.log(`    ${String(row.id)}: ${String(row.name)}`)
    }
  }

  console.log("\nDone.")
}

void main()
