/**
 * Integration tests for rqlite client against a real rqlite instance.
 *
 * These tests require Docker. Run with:
 *   bun run test:integration
 *
 * The harness starts an rqlite container before tests and stops it after.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { RqliteClient } from "../../client"
import { QueryError } from "../../errors"
import { isErr, isOk } from "../../result"
import { getRqliteHost, startRqlite, stopRqlite, waitForReady } from "./harness"

let client: RqliteClient

beforeAll(async () => {
  startRqlite()
  await waitForReady()
  client = new RqliteClient({ host: getRqliteHost() })
}, 60_000)

afterAll(() => {
  stopRqlite()
})

describe("rqlite integration", () => {
  describe("cluster status", () => {
    it("returns node status", async () => {
      const result = await client.status()

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value).toHaveProperty("build")
        expect(result.value).toHaveProperty("store")
      }
    })

    it("reports node as ready", async () => {
      const result = await client.ready()

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.ready).toBe(true)
      }
    })

    it("lists cluster nodes", async () => {
      const result = await client.nodes()

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.length).toBeGreaterThanOrEqual(1)
        const node = result.value[0]
        expect(node.id).toBeDefined()
        expect(node.apiAddr).toBeDefined()
        expect(node.reachable).toBe(true)
      }
    })
  })

  describe("execute and query", () => {
    it("creates a table", async () => {
      const result = await client.execute(
        "CREATE TABLE IF NOT EXISTS test_users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)"
      )

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.time).toBeGreaterThanOrEqual(0)
      }
    })

    it("inserts a row", async () => {
      const result = await client.execute("INSERT INTO test_users(name, email) VALUES(?, ?)", [
        "Alice",
        "alice@example.com"
      ])

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.rowsAffected).toBe(1)
        expect(result.value.lastInsertId).toBeGreaterThan(0)
      }
    })

    it("queries rows", async () => {
      const result = await client.query("SELECT * FROM test_users WHERE name = ?", ["Alice"])

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.columns).toContain("name")
        expect(result.value.columns).toContain("email")
        expect(result.value.values.length).toBeGreaterThanOrEqual(1)
        expect(result.value.values[0]).toContain("Alice")
      }
    })

    it("returns QueryError for invalid SQL", async () => {
      const result = await client.execute("INVALID SQL STATEMENT")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(QueryError.isError(result.error)).toBe(true)
      }
    })
  })

  describe("batch operations", () => {
    it("executes a batch of statements", async () => {
      const result = await client.executeBatch([
        ["INSERT INTO test_users(name, email) VALUES(?, ?)", "Bob", "bob@example.com"],
        ["INSERT INTO test_users(name, email) VALUES(?, ?)", "Charlie", "charlie@example.com"]
      ])

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value).toHaveLength(2)
        expect(result.value[0].rowsAffected).toBe(1)
        expect(result.value[1].rowsAffected).toBe(1)
      }
    })

    it("queries a batch of statements", async () => {
      const result = await client.queryBatch([
        ["SELECT * FROM test_users WHERE name = ?", "Bob"],
        ["SELECT COUNT(*) FROM test_users"]
      ])

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value).toHaveLength(2)
        expect(result.value[0].values.length).toBeGreaterThanOrEqual(1)
        expect(result.value[1].values[0][0]).toBeGreaterThanOrEqual(3)
      }
    })
  })

  describe("transactions", () => {
    it("executes statements in a transaction", async () => {
      const result = await client.executeBatch(
        [
          ["INSERT INTO test_users(name, email) VALUES(?, ?)", "TxnUser1", "txn1@example.com"],
          ["INSERT INTO test_users(name, email) VALUES(?, ?)", "TxnUser2", "txn2@example.com"]
        ],
        { transaction: true }
      )

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value).toHaveLength(2)
      }

      // Verify both rows exist
      const query = await client.query("SELECT COUNT(*) FROM test_users WHERE name LIKE 'TxnUser%'")
      expect(isOk(query)).toBe(true)
      if (query.ok) {
        expect(query.value.values[0][0]).toBe(2)
      }
    })
  })

  describe("unified request", () => {
    it("handles mixed read/write operations", async () => {
      const result = await client.requestBatch([
        ["INSERT INTO test_users(name, email) VALUES(?, ?)", "ReqUser", "req@example.com"],
        ["SELECT * FROM test_users WHERE name = ?", "ReqUser"]
      ])

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value).toHaveLength(2)
        expect(result.value[0].type).toBe("execute")
        expect(result.value[1].type).toBe("query")
        if (result.value[1].type === "query") {
          expect(result.value[1].values.length).toBeGreaterThanOrEqual(1)
        }
      }
    })
  })

  describe("consistency levels", () => {
    it("queries with strong consistency", async () => {
      const result = await client.query("SELECT COUNT(*) FROM test_users", undefined, {
        level: "strong"
      })

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.values[0][0]).toBeGreaterThan(0)
      }
    })

    it("queries with none consistency", async () => {
      const result = await client.query("SELECT COUNT(*) FROM test_users", undefined, {
        level: "none"
      })

      expect(isOk(result)).toBe(true)
    })
  })

  describe("paginated queries", () => {
    it("paginates over a multi-page result set", async () => {
      // Insert enough rows into a dedicated table
      await client.execute(
        "CREATE TABLE IF NOT EXISTS pagination_test (id INTEGER PRIMARY KEY, val TEXT)"
      )
      const statements: unknown[] = []
      for (let i = 1; i <= 10; i++) {
        statements.push([
          "INSERT INTO pagination_test(id, val) VALUES(?, ?)",
          i,
          `row-${String(i)}`
        ])
      }
      const insertResult = await client.executeBatch(statements)
      expect(isOk(insertResult)).toBe(true)

      // Paginate with pageSize=3 → expect 4 pages (3+3+3+1)
      const pages = []
      for await (const page of client.queryPaginated(
        "SELECT id, val FROM pagination_test ORDER BY id",
        [],
        { pageSize: 3 }
      )) {
        pages.push(page)
      }

      expect(pages.length).toBeGreaterThanOrEqual(3)

      // All values collected should cover ids 1–10
      const allIds = pages.flatMap((p) => p.rows.values.map((row) => row[0]))
      expect(allIds).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

      // Last page should have hasMore=false
      expect(pages[pages.length - 1].hasMore).toBe(false)

      // All other pages should have hasMore=true
      for (let i = 0; i < pages.length - 1; i++) {
        expect(pages[i].hasMore).toBe(true)
        expect(pages[i].rows.values).toHaveLength(3)
      }
    })
  })
})
