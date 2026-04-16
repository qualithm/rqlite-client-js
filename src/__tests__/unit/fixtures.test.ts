import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { RqliteClient } from "../../client"
import { AuthenticationError, QueryError } from "../../errors"
import { isErr, isOk } from "../../result"
import { getFixture, mockFetchSequence, mockFetchWithFixture } from "../fixtures"

// =============================================================================
// Helpers
// =============================================================================

function createClient(
  options?: Partial<ConstructorParameters<typeof RqliteClient>[0]>
): RqliteClient {
  return new RqliteClient({ host: "localhost:4001", clusterDiscovery: false, ...options })
}

// =============================================================================
// Tests
// =============================================================================

describe("fixture-based tests", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe("execute fixtures", () => {
    it("replays create table response", async () => {
      mockFetchWithFixture("execute", "createTable")
      const client = createClient()

      const result = await client.execute("CREATE TABLE foo (id INTEGER PRIMARY KEY)")

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.time).toBe(0.000452)
      }
    })

    it("replays insert row response", async () => {
      mockFetchWithFixture("execute", "insertRow")
      const client = createClient()

      const result = await client.execute("INSERT INTO foo VALUES(?, ?)", [1, "bar"])

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.lastInsertId).toBe(1)
        expect(result.value.rowsAffected).toBe(1)
      }
    })

    it("replays batch insert response", async () => {
      mockFetchWithFixture("execute", "insertBatch")
      const client = createClient()

      const result = await client.executeBatch([
        ["INSERT INTO foo VALUES(?, ?)", 2, "baz"],
        ["INSERT INTO foo VALUES(?, ?)", 3, "qux"]
      ])

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value).toHaveLength(2)
        expect(result.value[0].lastInsertId).toBe(2)
        expect(result.value[1].lastInsertId).toBe(3)
      }
    })

    it("replays SQL error response", async () => {
      mockFetchWithFixture("execute", "sqlError")
      const client = createClient()

      const result = await client.execute("INVALID SQL")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(QueryError.isError(result.error)).toBe(true)
        expect(result.error.message).toContain("syntax error")
      }
    })
  })

  describe("query fixtures", () => {
    it("replays select rows response", async () => {
      mockFetchWithFixture("query", "selectRows")
      const client = createClient()

      const result = await client.query("SELECT * FROM users")

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.columns).toEqual(["id", "name", "email"])
        expect(result.value.values).toHaveLength(2)
        expect(result.value.values[0]).toEqual([1, "Alice", "alice@example.com"])
      }
    })

    it("replays select count response", async () => {
      mockFetchWithFixture("query", "selectCount")
      const client = createClient()

      const result = await client.query("SELECT COUNT(*) FROM users")

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.values[0][0]).toBe(5)
      }
    })

    it("replays empty result response", async () => {
      mockFetchWithFixture("query", "emptyResult")
      const client = createClient()

      const result = await client.query("SELECT * FROM users WHERE id = -1")

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.columns).toEqual(["id", "name"])
        expect(result.value.values).toEqual([])
      }
    })
  })

  describe("error fixtures", () => {
    it("replays unauthorised response", async () => {
      mockFetchWithFixture("errors", "unauthorised")
      const client = createClient({ maxRetries: 0 })

      const result = await client.query("SELECT 1")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(AuthenticationError.isError(result.error)).toBe(true)
      }
    })

    it("replays forbidden response", async () => {
      mockFetchWithFixture("errors", "forbidden")
      const client = createClient({ maxRetries: 0 })

      const result = await client.query("SELECT 1")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(AuthenticationError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("forbidden")
      }
    })
  })

  describe("fixture sequences", () => {
    it("replays leader redirect then success", async () => {
      vi.useRealTimers()
      mockFetchSequence([
        getFixture("errors", "leaderRedirect"),
        getFixture("execute", "insertRow")
      ])
      const client = createClient()

      const result = await client.execute("INSERT INTO foo VALUES(1)")

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.lastInsertId).toBe(1)
      }
    })
  })
})
