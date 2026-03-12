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
  return new RqliteClient({ host: "localhost:4001", ...options })
}

// =============================================================================
// Tests
// =============================================================================

describe("RqliteClient query", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe("query", () => {
    it("executes a simple SQL query", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: {
          results: [
            {
              columns: ["id", "name"],
              types: ["integer", "text"],
              values: [
                [1, "bar"],
                [2, "baz"]
              ],
              time: 0.001
            }
          ]
        }
      })
      const client = createClient()

      const result = await client.query("SELECT * FROM foo")

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.columns).toEqual(["id", "name"])
        expect(result.value.types).toEqual(["integer", "text"])
        expect(result.value.values).toEqual([
          [1, "bar"],
          [2, "baz"]
        ])
        expect(result.value.time).toBe(0.001)
      }
    })

    it("executes a parameterised SQL query", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: {
          results: [
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

      const result = await client.query("SELECT * FROM foo WHERE id = ?", [1])

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.values).toEqual([[1, "bar"]])
      }
      // Verify the body sent to rqlite
      const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as unknown[]
      expect(body).toEqual([["SELECT * FROM foo WHERE id = ?", 1]])
    })

    it("sends a simple string statement without params", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: {
          results: [{ columns: ["1"], types: [""], values: [[1]], time: 0.001 }]
        }
      })
      const client = createClient()

      await client.query("SELECT 1")

      const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as unknown[]
      expect(body).toEqual([["SELECT 1"]])
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

      const result = await client.query("SELEC * FROM foo")

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

      const result = await client.query("SELECT * FROM foo")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("empty query response")
      }
    })

    it("returns ConnectionError when results field is missing", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: {}
      })
      const client = createClient()

      const result = await client.query("SELECT * FROM foo")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("missing results in query response")
      }
    })

    it("defaults missing fields to empty arrays and zero", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: { results: [{}] }
      })
      const client = createClient()

      const result = await client.query("SELECT * FROM empty_table")

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.columns).toEqual([])
        expect(result.value.types).toEqual([])
        expect(result.value.values).toEqual([])
        expect(result.value.time).toBe(0)
      }
    })

    it("posts to /db/query endpoint", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ columns: [], types: [], values: [], time: 0 }] }
      })
      const client = createClient()

      await client.query("SELECT 1")

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain("/db/query")
    })
  })

  describe("queryBatch", () => {
    it("executes multiple queries", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: {
          results: [
            {
              columns: ["id", "name"],
              types: ["integer", "text"],
              values: [[1, "bar"]],
              time: 0.001
            },
            {
              columns: ["count(*)"],
              types: ["integer"],
              values: [[5]],
              time: 0.001
            }
          ]
        }
      })
      const client = createClient()

      const result = await client.queryBatch([
        ["SELECT * FROM foo WHERE id = ?", 1],
        ["SELECT COUNT(*) FROM foo"]
      ])

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value).toHaveLength(2)
        expect(result.value[0]?.columns).toEqual(["id", "name"])
        expect(result.value[1]?.columns).toEqual(["count(*)"])
      }
    })

    it("returns QueryError if any query fails", async () => {
      mockFetch({
        ok: true,
        status: 200,
        data: {
          results: [
            { columns: ["1"], types: [""], values: [[1]], time: 0.001 },
            { error: "no such table: bar" }
          ]
        }
      })
      const client = createClient()

      const result = await client.queryBatch([["SELECT 1"], ["SELECT * FROM bar"]])

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(QueryError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("no such table: bar")
      }
    })
  })

  describe("query options", () => {
    it("sends consistency level query parameter", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ columns: [], types: [], values: [], time: 0 }] }
      })
      const client = createClient()

      await client.query("SELECT 1", undefined, { level: "strong" })

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

      await client.query("SELECT 1", undefined, {
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

      await client.query("SELECT 1", undefined, {
        freshness: { freshness: "5s", freshnessStrict: true }
      })

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain("freshness=5s")
      expect(url).toContain("freshness_strict=")
    })

    it("sends associative query parameter", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ columns: [], types: [], values: [], time: 0 }] }
      })
      const client = createClient()

      await client.query("SELECT 1", undefined, { associative: true })

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain("associative=")
    })

    it("uses client default consistency level", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ columns: [], types: [], values: [], time: 0 }] }
      })
      const client = createClient({ consistencyLevel: "weak" })

      await client.query("SELECT 1")

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain("level=weak")
    })

    it("uses client default freshness options", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ columns: [], types: [], values: [], time: 0 }] }
      })
      const client = createClient({ freshness: { freshness: "2s" } })

      await client.query("SELECT 1")

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain("freshness=2s")
    })

    it("overrides client defaults with per-query options", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ columns: [], types: [], values: [], time: 0 }] }
      })
      const client = createClient({ consistencyLevel: "weak" })

      await client.query("SELECT 1", undefined, { level: "strong" })

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain("level=strong")
      expect(url).not.toContain("level=weak")
    })

    it("does not send params when no options provided", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: { results: [{ columns: [], types: [], values: [], time: 0 }] }
      })
      const client = createClient()

      await client.query("SELECT 1")

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).not.toContain("level=")
      expect(url).not.toContain("freshness=")
      expect(url).not.toContain("associative=")
    })

    it("sends multiple options together", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        data: {
          results: [
            { columns: [], types: [], values: [], time: 0 },
            { columns: [], types: [], values: [], time: 0 }
          ]
        }
      })
      const client = createClient()

      await client.queryBatch([["SELECT 1"], ["SELECT 2"]], {
        level: "none",
        freshness: { freshness: "1s" },
        associative: true
      })

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain("level=none")
      expect(url).toContain("freshness=1s")
      expect(url).toContain("associative=")
    })
  })
})
