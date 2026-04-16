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

function createClient(
  options?: Partial<ConstructorParameters<typeof RqliteClient>[0]>
): RqliteClient {
  return new RqliteClient({ host: "localhost:4001", clusterDiscovery: false, ...options })
}

// =============================================================================
// Tests
// =============================================================================

describe("RqliteClient requestBatch", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe("mixed read/write", () => {
    it("handles mixed execute and query results", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: {
          results: [
            { last_insert_id: 1, rows_affected: 1, time: 0.001 },
            {
              columns: ["id", "name"],
              types: ["integer", "text"],
              values: [[1, "bar"]],
              time: 0.002
            }
          ]
        }
      })
      const client = createClient()

      const result = await client.requestBatch([
        ["INSERT INTO foo VALUES(?, ?)", 1, "bar"],
        ["SELECT * FROM foo"]
      ])

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value).toHaveLength(2)

        const exec = result.value[0]
        expect(exec.type).toBe("execute")
        if (exec.type === "execute") {
          expect(exec.lastInsertId).toBe(1)
          expect(exec.rowsAffected).toBe(1)
          expect(exec.time).toBe(0.001)
        }

        const query = result.value[1]
        expect(query.type).toBe("query")
        if (query.type === "query") {
          expect(query.columns).toEqual(["id", "name"])
          expect(query.types).toEqual(["integer", "text"])
          expect(query.values).toEqual([[1, "bar"]])
          expect(query.time).toBe(0.002)
        }
      }
    })

    it("detects SELECT statements as queries (case-insensitive)", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: {
          results: [
            { columns: ["1"], types: [""], values: [[1]], time: 0.001 },
            { columns: ["1"], types: [""], values: [[1]], time: 0.001 }
          ]
        }
      })
      const client = createClient()

      const result = await client.requestBatch([["select 1"], ["  SELECT 1"]])

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value[0]?.type).toBe("query")
        expect(result.value[1]?.type).toBe("query")
      }
    })

    it("detects non-SELECT statements as execute", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: {
          results: [
            { rows_affected: 0, time: 0.001 },
            { rows_affected: 1, time: 0.001 },
            { rows_affected: 1, time: 0.001 }
          ]
        }
      })
      const client = createClient()

      const result = await client.requestBatch([
        ["CREATE TABLE foo (id INTEGER PRIMARY KEY, name TEXT)"],
        ["INSERT INTO foo VALUES(1, 'bar')"],
        ["UPDATE foo SET name = 'baz' WHERE id = 1"]
      ])

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value[0]?.type).toBe("execute")
        expect(result.value[1]?.type).toBe("execute")
        expect(result.value[2]?.type).toBe("execute")
      }
    })
  })

  describe("endpoint", () => {
    it("posts to /db/request endpoint", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ rows_affected: 0, time: 0.001 }] }
      })
      const client = createClient()

      await client.requestBatch([["CREATE TABLE foo (id INTEGER)"]])

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain("/db/request")
    })

    it("sends statements as POST body", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: {
          results: [
            { rows_affected: 1, time: 0.001 },
            { columns: ["id"], types: ["integer"], values: [[1]], time: 0.001 }
          ]
        }
      })
      const client = createClient()

      const statements = [["INSERT INTO foo VALUES(?, ?)", 1, "bar"], ["SELECT * FROM foo"]]
      await client.requestBatch(statements)

      const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as unknown[]
      expect(body).toEqual(statements)
    })
  })

  describe("error handling", () => {
    it("returns QueryError when rqlite reports a statement error", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: {
          results: [{ rows_affected: 1, time: 0.001 }, { error: "no such table: bar" }]
        }
      })
      const client = createClient()

      const result = await client.requestBatch([
        ["INSERT INTO foo VALUES(1)"],
        ["SELECT * FROM bar"]
      ])

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(QueryError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("no such table: bar")
      }
    })

    it("returns ConnectionError when results field is missing", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: {}
      })
      const client = createClient()

      const result = await client.requestBatch([["SELECT 1"]])

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("missing results in request response")
      }
    })

    it("defaults missing numeric fields to zero", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: { results: [{}] }
      })
      const client = createClient()

      const result = await client.requestBatch([["INSERT INTO foo VALUES(1)"]])

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        const r = result.value[0]
        expect(r.type).toBe("execute")
        if (r.type === "execute") {
          expect(r.lastInsertId).toBe(0)
          expect(r.rowsAffected).toBe(0)
          expect(r.time).toBe(0)
        }
      }
    })

    it("defaults missing query fields to empty arrays", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: { results: [{}] }
      })
      const client = createClient()

      const result = await client.requestBatch([["SELECT * FROM foo"]])

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        const r = result.value[0]
        expect(r.type).toBe("query")
        if (r.type === "query") {
          expect(r.columns).toEqual([])
          expect(r.types).toEqual([])
          expect(r.values).toEqual([])
          expect(r.time).toBe(0)
        }
      }
    })
  })

  describe("options", () => {
    it("sends transaction query parameter", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: {
          results: [
            { rows_affected: 1, time: 0.001 },
            { columns: ["id"], types: ["integer"], values: [[1]], time: 0.001 }
          ]
        }
      })
      const client = createClient()

      await client.requestBatch([["INSERT INTO foo VALUES(1)"], ["SELECT * FROM foo"]], {
        transaction: true
      })

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain("transaction=")
    })

    it("sends consistency level query parameter", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ columns: [], types: [], values: [], time: 0 }] }
      })
      const client = createClient()

      await client.requestBatch([["SELECT 1"]], { level: "strong" })

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain("level=strong")
    })

    it("sends freshness query parameter", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ columns: [], types: [], values: [], time: 0 }] }
      })
      const client = createClient()

      await client.requestBatch([["SELECT 1"]], {
        freshness: { freshness: "1s" }
      })

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain("freshness=1s")
    })

    it("sends freshness_strict query parameter", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ columns: [], types: [], values: [], time: 0 }] }
      })
      const client = createClient()

      await client.requestBatch([["SELECT 1"]], {
        freshness: { freshness: "5s", freshnessStrict: true }
      })

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain("freshness=5s")
      expect(url).toContain("freshness_strict=")
    })

    it("uses client default consistency level", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ columns: [], types: [], values: [], time: 0 }] }
      })
      const client = createClient({ consistencyLevel: "weak" })

      await client.requestBatch([["SELECT 1"]])

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain("level=weak")
    })

    it("overrides client defaults with per-request options", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ columns: [], types: [], values: [], time: 0 }] }
      })
      const client = createClient({ consistencyLevel: "weak" })

      await client.requestBatch([["SELECT 1"]], { level: "strong" })

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain("level=strong")
      expect(url).not.toContain("level=weak")
    })

    it("does not send params when no options provided", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ rows_affected: 0, time: 0.001 }] }
      })
      const client = createClient()

      await client.requestBatch([["INSERT INTO foo VALUES(1)"]])

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).not.toContain("transaction=")
      expect(url).not.toContain("level=")
      expect(url).not.toContain("freshness=")
    })

    it("sends multiple options together", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: {
          results: [
            { rows_affected: 1, time: 0.001 },
            { columns: [], types: [], values: [], time: 0 }
          ]
        }
      })
      const client = createClient()

      await client.requestBatch([["INSERT INTO foo VALUES(1)"], ["SELECT * FROM foo"]], {
        transaction: true,
        level: "strong",
        freshness: { freshness: "1s", freshnessStrict: true }
      })

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain("transaction=")
      expect(url).toContain("level=strong")
      expect(url).toContain("freshness=1s")
      expect(url).toContain("freshness_strict=")
    })
  })

  describe("HTTP failure", () => {
    it("returns error when HTTP request fails", async () => {
      mockFetch({ ok: false, status: 500, text: "internal server error" })
      const client = createClient({ maxRetries: 0 })

      const result = await client.requestBatch([["INSERT INTO foo VALUES(1)"], ["SELECT 1"]])

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
        expect(result.error.message).toContain("500")
      }
    })
  })

  describe("string statements", () => {
    it("handles plain string statements as execute", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ rows_affected: 1, time: 0.001 }] }
      })
      const client = createClient()

      const result = await client.requestBatch(["INSERT INTO foo VALUES(1)"])

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value[0].type).toBe("execute")
      }
    })

    it("detects plain string SELECT as query", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ columns: ["1"], types: [""], values: [[1]], time: 0.001 }] }
      })
      const client = createClient()

      const result = await client.requestBatch(["SELECT 1"])

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value[0].type).toBe("query")
      }
    })

    it("treats non-string non-array statements as execute", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ rows_affected: 0, time: 0.001 }] }
      })
      const client = createClient()

      const result = await client.requestBatch([42])

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value[0].type).toBe("execute")
      }
    })
  })
})
