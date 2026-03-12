/**
 * Property-based tests for SQL parameterisation edge cases.
 *
 * Uses fast-check to generate random SQL values and verify the client
 * correctly serialises them when building request bodies.
 */

import fc from "fast-check"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { RqliteClient } from "../../client"
import { isOk } from "../../result"

// =============================================================================
// Helpers
// =============================================================================

/** Create a mock fetch and return a helper to extract the request body. */
function captureFetchBody(): { fetchMock: ReturnType<typeof vi.fn>; getBody: () => unknown } {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: vi.fn().mockResolvedValue({
      results: [{ last_insert_id: 1, rows_affected: 1, time: 0.001 }]
    }),
    text: vi.fn().mockResolvedValue("")
  })
  vi.stubGlobal("fetch", fetchMock)

  return {
    fetchMock,
    getBody: () => {
      const call = fetchMock.mock.calls[0] as [string, RequestInit]
      return call[1].body !== undefined ? JSON.parse(call[1].body as string) : undefined
    }
  }
}

// =============================================================================
// Tests
// =============================================================================

describe("SQL parameterisation properties", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe("value serialisation", () => {
    it("serialises string parameters without corruption", async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), async (value) => {
          const { getBody } = captureFetchBody()
          const client = new RqliteClient({ host: "localhost:4001" })

          await client.execute("INSERT INTO t(v) VALUES(?)", [value])

          const body = getBody() as unknown[][]
          expect(body[0]).toEqual(["INSERT INTO t(v) VALUES(?)", value])
        })
      )
    })

    it("serialises numeric parameters including edge cases", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            // JSON.stringify(-0) === "0", so exclude -0 from all generators
            fc.integer().filter((v) => !Object.is(v, -0)),
            fc.double({ noNaN: true, noDefaultInfinity: true }).filter((v) => !Object.is(v, -0)),
            fc.constant(0),
            fc.constant(Number.MAX_SAFE_INTEGER),
            fc.constant(Number.MIN_SAFE_INTEGER)
          ),
          async (value) => {
            const { getBody } = captureFetchBody()
            const client = new RqliteClient({ host: "localhost:4001" })

            await client.execute("INSERT INTO t(v) VALUES(?)", [value])

            const body = getBody() as unknown[][]
            expect(body[0]).toEqual(["INSERT INTO t(v) VALUES(?)", value])
          }
        )
      )
    })

    it("serialises boolean parameters as booleans", async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (value) => {
          const { getBody } = captureFetchBody()
          const client = new RqliteClient({ host: "localhost:4001" })

          await client.execute("INSERT INTO t(v) VALUES(?)", [value])

          const body = getBody() as unknown[][]
          expect(body[0]).toEqual(["INSERT INTO t(v) VALUES(?)", value])
        })
      )
    })

    it("serialises null parameters", async () => {
      const { getBody } = captureFetchBody()
      const client = new RqliteClient({ host: "localhost:4001" })

      await client.execute("INSERT INTO t(v) VALUES(?)", [null])

      const body = getBody() as unknown[][]
      expect(body[0]).toEqual(["INSERT INTO t(v) VALUES(?)", null])
    })

    it("preserves parameter order for multiple placeholders", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
            fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
            fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null))
          ),
          async ([a, b, c]) => {
            const { getBody } = captureFetchBody()
            const client = new RqliteClient({ host: "localhost:4001" })

            await client.execute("INSERT INTO t(a, b, c) VALUES(?, ?, ?)", [a, b, c])

            const body = getBody() as unknown[][]
            expect(body[0]).toEqual(["INSERT INTO t(a, b, c) VALUES(?, ?, ?)", a, b, c])
          }
        )
      )
    })
  })

  describe("string edge cases", () => {
    it("handles strings with SQL-special characters", async () => {
      const specialStrings = [
        "'; DROP TABLE t; --",
        "O'Reilly",
        'He said "hello"',
        "line1\nline2",
        "tab\there",
        "null\x00byte",
        "emoji 🎉",
        "backslash \\",
        "percent %",
        "underscore _"
      ]

      for (const value of specialStrings) {
        const { getBody } = captureFetchBody()
        const client = new RqliteClient({ host: "localhost:4001" })

        await client.execute("INSERT INTO t(v) VALUES(?)", [value])

        const body = getBody() as unknown[][]
        expect(body[0][1]).toBe(value)
      }
    })

    it("handles unicode strings", async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), async (value: string) => {
          const { getBody } = captureFetchBody()
          const client = new RqliteClient({ host: "localhost:4001" })

          await client.execute("INSERT INTO t(v) VALUES(?)", [value])

          const body = getBody() as unknown[][]
          expect(body[0][1]).toBe(value)
        })
      )
    })

    it("handles very long strings", async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1000, maxLength: 10_000 }), async (value) => {
          const { getBody } = captureFetchBody()
          const client = new RqliteClient({ host: "localhost:4001" })

          await client.execute("INSERT INTO t(v) VALUES(?)", [value])

          const body = getBody() as unknown[][]
          expect(body[0][1]).toBe(value)
        })
      )
    })
  })

  describe("batch parameterisation", () => {
    it("serialises multiple parameterised statements in a batch", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.tuple(fc.string(), fc.integer()), { minLength: 1, maxLength: 10 }),
          async (rows) => {
            const { getBody } = captureFetchBody()
            const client = new RqliteClient({ host: "localhost:4001" })

            const statements = rows.map(([name, id]) => [
              "INSERT INTO t(name, id) VALUES(?, ?)",
              name,
              id
            ])
            await client.executeBatch(statements)

            const body = getBody() as unknown[][]
            expect(body).toHaveLength(rows.length)
            for (let i = 0; i < rows.length; i++) {
              expect(body[i]).toEqual([
                "INSERT INTO t(name, id) VALUES(?, ?)",
                rows[i][0],
                rows[i][1]
              ])
            }
          }
        )
      )
    })
  })

  describe("query parameterisation", () => {
    it("serialises query parameters correctly", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
          async (value) => {
            const fetchMock = vi.fn().mockResolvedValue({
              ok: true,
              status: 200,
              headers: new Headers(),
              json: vi.fn().mockResolvedValue({
                results: [{ columns: ["v"], types: ["text"], values: [[value]], time: 0.001 }]
              }),
              text: vi.fn().mockResolvedValue("")
            })
            vi.stubGlobal("fetch", fetchMock)
            const client = new RqliteClient({ host: "localhost:4001" })

            const result = await client.query("SELECT * FROM t WHERE v = ?", [value])

            expect(isOk(result)).toBe(true)

            const call = fetchMock.mock.calls[0] as [string, RequestInit]
            const body = JSON.parse(call[1].body as string) as unknown[][]
            expect(body[0]).toEqual(["SELECT * FROM t WHERE v = ?", value])
          }
        )
      )
    })
  })
})
