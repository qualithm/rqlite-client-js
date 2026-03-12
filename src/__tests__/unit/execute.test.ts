import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { RqliteClient } from "../../client"
import { ConnectionError, QueryError } from "../../errors"
import { isErr, isOk } from "../../result"

// =============================================================================
// Helpers
// =============================================================================

type MockResponseInit = {
  ok: boolean
  status: number
  data?: unknown
  text?: string
}

function mockFetch(response: MockResponseInit): ReturnType<typeof vi.fn> {
  const json = vi.fn().mockResolvedValue(response.data ?? {})
  const text = vi.fn().mockResolvedValue(response.text ?? "")
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json,
    text,
    headers: new Headers()
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function createClient(): RqliteClient {
  return new RqliteClient({ host: "localhost:4001" })
}

// =============================================================================
// Tests
// =============================================================================

describe("RqliteClient execute", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe("execute", () => {
    it("executes a simple SQL statement", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: {
          results: [{ last_insert_id: 1, rows_affected: 1, time: 0.001 }]
        }
      })
      const client = createClient()

      const result = await client.execute("INSERT INTO foo VALUES(1, 'bar')")

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.lastInsertId).toBe(1)
        expect(result.value.rowsAffected).toBe(1)
        expect(result.value.time).toBe(0.001)
      }
    })

    it("executes a parameterised SQL statement", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: {
          results: [{ last_insert_id: 2, rows_affected: 1, time: 0.002 }]
        }
      })
      const client = createClient()

      const result = await client.execute("INSERT INTO foo VALUES(?, ?)", [2, "baz"])

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.lastInsertId).toBe(2)
      }
      // Verify the body sent to rqlite
      const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as unknown[]
      expect(body).toEqual([["INSERT INTO foo VALUES(?, ?)", 2, "baz"]])
    })

    it("sends a simple string statement without params", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ rows_affected: 0, time: 0.001 }] }
      })
      const client = createClient()

      await client.execute("CREATE TABLE foo (id INTEGER PRIMARY KEY, name TEXT)")

      const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as unknown[]
      expect(body).toEqual([["CREATE TABLE foo (id INTEGER PRIMARY KEY, name TEXT)"]])
    })

    it("returns QueryError when rqlite reports a statement error", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: {
          results: [{ error: 'near "SELEC": syntax error' }]
        }
      })
      const client = createClient()

      const result = await client.execute("SELEC 1")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(QueryError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe('near "SELEC": syntax error')
      }
    })

    it("returns ConnectionError on empty response", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: { results: [] }
      })
      const client = createClient()

      const result = await client.execute("INSERT INTO foo VALUES(1)")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("empty execute response")
      }
    })

    it("returns ConnectionError when results field is missing", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: {}
      })
      const client = createClient()

      const result = await client.execute("INSERT INTO foo VALUES(1)")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("missing results in execute response")
      }
    })

    it("defaults missing numeric fields to zero", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: { results: [{}] }
      })
      const client = createClient()

      const result = await client.execute("DELETE FROM foo")

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.lastInsertId).toBe(0)
        expect(result.value.rowsAffected).toBe(0)
        expect(result.value.time).toBe(0)
      }
    })
  })

  describe("executeBatch", () => {
    it("executes multiple statements", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: {
          results: [
            { last_insert_id: 1, rows_affected: 1, time: 0.001 },
            { last_insert_id: 2, rows_affected: 1, time: 0.002 }
          ]
        }
      })
      const client = createClient()

      const result = await client.executeBatch([
        ["INSERT INTO foo VALUES(?, ?)", 1, "bar"],
        ["INSERT INTO foo VALUES(?, ?)", 2, "baz"]
      ])

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value).toHaveLength(2)
        expect(result.value[0]?.lastInsertId).toBe(1)
        expect(result.value[1]?.lastInsertId).toBe(2)
      }
    })

    it("returns QueryError if any statement fails", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: {
          results: [
            { last_insert_id: 1, rows_affected: 1, time: 0.001 },
            { error: "UNIQUE constraint failed: foo.id" }
          ]
        }
      })
      const client = createClient()

      const result = await client.executeBatch([
        ["INSERT INTO foo VALUES(1, 'a')"],
        ["INSERT INTO foo VALUES(1, 'b')"]
      ])

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(QueryError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("UNIQUE constraint failed: foo.id")
      }
    })
  })

  describe("execute options", () => {
    it("sends transaction query parameter", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ rows_affected: 1, time: 0.001 }] }
      })
      const client = createClient()

      await client.execute("INSERT INTO foo VALUES(1)", undefined, { transaction: true })

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain("transaction=")
    })

    it("sends queue query parameter", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ rows_affected: 1, time: 0.001 }] }
      })
      const client = createClient()

      await client.execute("INSERT INTO foo VALUES(1)", undefined, { queue: true })

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain("queue=")
    })

    it("sends wait query parameter", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ rows_affected: 1, time: 0.001 }] }
      })
      const client = createClient()

      await client.execute("INSERT INTO foo VALUES(1)", undefined, { wait: true })

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain("wait=")
    })

    it("sends multiple options together", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: {
          results: [
            { rows_affected: 1, time: 0.001 },
            { rows_affected: 1, time: 0.001 }
          ]
        }
      })
      const client = createClient()

      await client.executeBatch([["INSERT INTO foo VALUES(1)"], ["INSERT INTO foo VALUES(2)"]], {
        transaction: true,
        queue: true,
        wait: true
      })

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain("transaction=")
      expect(url).toContain("queue=")
      expect(url).toContain("wait=")
    })

    it("does not send params when no options provided", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ rows_affected: 1, time: 0.001 }] }
      })
      const client = createClient()

      await client.execute("INSERT INTO foo VALUES(1)")

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).not.toContain("transaction")
      expect(url).not.toContain("queue")
      expect(url).not.toContain("wait")
    })

    it("posts to /db/execute endpoint", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ rows_affected: 0, time: 0.001 }] }
      })
      const client = createClient()

      await client.execute("CREATE TABLE foo (id INTEGER)")

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain("/db/execute")
    })
  })
})
