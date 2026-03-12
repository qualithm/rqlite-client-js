/**
 * Transaction example.
 *
 * Demonstrates wrapping multiple statements in an atomic transaction.
 *
 * @example
 * ```bash
 * bun run examples/transactions.ts
 * ```
 */

/* eslint-disable no-console */

import { createRqliteClient } from "@qualithm/rqlite-client"

async function main(): Promise<void> {
  console.log("=== Transactions ===\n")

  const client = createRqliteClient({ host: "localhost:4001" })

  // Set up tables
  await client.execute(
    "CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY, name TEXT, balance REAL)"
  )
  await client.executeBatch([
    ["INSERT OR REPLACE INTO accounts(id, name, balance) VALUES(?, ?, ?)", 1, "Alice", 1000],
    ["INSERT OR REPLACE INTO accounts(id, name, balance) VALUES(?, ?, ?)", 2, "Bob", 500]
  ])

  // Transfer funds atomically using a transaction
  console.log("--- Atomic transfer ---")
  const amount = 200
  const transfer = await client.executeBatch(
    [
      ["UPDATE accounts SET balance = balance - ? WHERE id = ?", amount, 1],
      ["UPDATE accounts SET balance = balance + ? WHERE id = ?", amount, 2]
    ],
    { transaction: true }
  )
  if (!transfer.ok) {
    console.error("transfer failed:", transfer.error.message)
    return
  }
  console.log(`  Transferred $${String(amount)} from Alice to Bob`)

  // Verify balances
  const balances = await client.query("SELECT name, balance FROM accounts ORDER BY id")
  if (balances.ok) {
    for (const row of balances.value.values) {
      console.log(`  ${String(row[0])}: $${String(row[1])}`)
    }
  }

  // Mixed request with transaction — writes and reads in one atomic call
  console.log("\n--- Mixed transactional request ---")
  const mixed = await client.requestBatch(
    [
      ["UPDATE accounts SET balance = balance + 50 WHERE id = ?", 1],
      ["UPDATE accounts SET balance = balance - 50 WHERE id = ?", 2],
      ["SELECT name, balance FROM accounts ORDER BY id"]
    ],
    { transaction: true }
  )
  if (mixed.ok) {
    for (const r of mixed.value) {
      if (r.type === "query") {
        for (const row of r.values) {
          console.log(`  ${String(row[0])}: $${String(row[1])}`)
        }
      }
    }
  }

  console.log("\nDone.")
}

void main()
