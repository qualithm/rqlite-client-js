import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { RqliteClient } from "../../client"
import { ConnectionError } from "../../errors"
import { toRowsPaginated } from "../../result"

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

function mockFetchSequence(responses: MockResponseInit[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn()
  for (const response of responses) {
    const json = vi.fn().mockResolvedValue(response.data ?? {})
    const text = vi.fn().mockResolvedValue(response.text ?? "")
    fetchMock.mockResolvedValueOnce({
      ok: response.ok,
      status: response.status,
      json,
      text,
      headers: new Headers()
    })
  }
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

describe("RqliteClient queryPaginated", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("iterates through multiple pages", async () => {
    const fetchMock = mockFetchSequence([
      // Page 1: returns pageSize+1 (3+1=4) rows → hasMore=true
      {
        ok: true,
        status: 200,
        data: {
          results: [
            {
              columns: ["id", "name"],
              types: ["integer", "text"],
              values: [
                [1, "Alice"],
                [2, "Bob"],
                [3, "Charlie"],
                [4, "Diana"]
              ],
              time: 0.001
            }
          ]
        }
      },
      // Page 2: returns exactly pageSize (3) rows → hasMore=false
      {
        ok: true,
        status: 200,
        data: {
          results: [
            {
              columns: ["id", "name"],
              types: ["integer", "text"],
              values: [
                [4, "Diana"],
                [5, "Eve"],
                [6, "Frank"]
              ],
              time: 0.001
            }
          ]
        }
      }
    ])

    const client = createClient()
    const pages = []

    for await (const page of client.queryPaginated("SELECT * FROM users", [], { pageSize: 3 })) {
      pages.push(page)
    }

    expect(pages).toHaveLength(2)

    // Page 1
    expect(pages[0].rows.values).toHaveLength(3)
    expect(pages[0].offset).toBe(0)
    expect(pages[0].hasMore).toBe(true)
    expect(pages[0].pageSize).toBe(3)

    // Page 2
    expect(pages[1].rows.values).toHaveLength(3)
    expect(pages[1].offset).toBe(3)
    expect(pages[1].hasMore).toBe(false)
    expect(pages[1].pageSize).toBe(3)

    // Verify LIMIT/OFFSET params in fetch calls
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(firstBody).toEqual([["SELECT * FROM users LIMIT ? OFFSET ?", 4, 0]])

    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string)
    expect(secondBody).toEqual([["SELECT * FROM users LIMIT ? OFFSET ?", 4, 3]])
  })

  it("returns a single page when results fit within pageSize", async () => {
    mockFetch({
      ok: true,
      status: 200,
      data: {
        results: [
          {
            columns: ["id"],
            types: ["integer"],
            values: [[1], [2]],
            time: 0.001
          }
        ]
      }
    })

    const client = createClient()
    const pages = []

    for await (const page of client.queryPaginated("SELECT id FROM t", [], { pageSize: 5 })) {
      pages.push(page)
    }

    expect(pages).toHaveLength(1)
    expect(pages[0].rows.values).toHaveLength(2)
    expect(pages[0].hasMore).toBe(false)
    expect(pages[0].offset).toBe(0)
  })

  it("handles empty results", async () => {
    mockFetch({
      ok: true,
      status: 200,
      data: {
        results: [
          {
            columns: ["id"],
            types: ["integer"],
            values: [],
            time: 0.001
          }
        ]
      }
    })

    const client = createClient()
    const pages = []

    for await (const page of client.queryPaginated("SELECT id FROM empty", [], { pageSize: 10 })) {
      pages.push(page)
    }

    expect(pages).toHaveLength(1)
    expect(pages[0].rows.values).toHaveLength(0)
    expect(pages[0].hasMore).toBe(false)
  })

  it("respects custom starting offset", async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      data: {
        results: [
          {
            columns: ["id"],
            types: ["integer"],
            values: [[5], [6]],
            time: 0.001
          }
        ]
      }
    })

    const client = createClient()
    const pages = []

    for await (const page of client.queryPaginated("SELECT id FROM t", [], {
      pageSize: 10,
      offset: 4
    })) {
      pages.push(page)
    }

    expect(pages).toHaveLength(1)
    expect(pages[0].offset).toBe(4)

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body).toEqual([["SELECT id FROM t LIMIT ? OFFSET ?", 11, 4]])
  })

  it("throws on query error", async () => {
    mockFetch({
      ok: true,
      status: 200,
      data: {
        results: [{ error: "no such table: missing" }]
      }
    })

    const client = createClient()

    await expect(async () => {
      for await (const _page of client.queryPaginated("SELECT * FROM missing", [], {
        pageSize: 10
      })) {
        // should not reach here
      }
    }).rejects.toThrow("no such table: missing")
  })

  it("throws on connection error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")))

    const client = createClient({ maxRetries: 0 })

    await expect(async () => {
      for await (const _page of client.queryPaginated("SELECT * FROM t", [], { pageSize: 10 })) {
        // should not reach here
      }
    }).rejects.toSatisfy((error: unknown) => ConnectionError.isError(error))
  })

  it("passes query options through", async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      data: {
        results: [
          {
            columns: ["id"],
            types: ["integer"],
            values: [],
            time: 0.001
          }
        ]
      }
    })

    const client = createClient()

    for await (const _page of client.queryPaginated("SELECT id FROM t", [], {
      pageSize: 10,
      level: "strong"
    })) {
      // consume
    }

    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain("level=strong")
  })

  it("handles partial last page", async () => {
    mockFetchSequence([
      // Page 1: 4 rows returned (3+1) → hasMore
      {
        ok: true,
        status: 200,
        data: {
          results: [
            {
              columns: ["id"],
              types: ["integer"],
              values: [[1], [2], [3], [4]],
              time: 0.001
            }
          ]
        }
      },
      // Page 2: 1 row returned (less than pageSize) → no more
      {
        ok: true,
        status: 200,
        data: {
          results: [
            {
              columns: ["id"],
              types: ["integer"],
              values: [[4]],
              time: 0.001
            }
          ]
        }
      }
    ])

    const client = createClient()
    const pages = []

    for await (const page of client.queryPaginated("SELECT id FROM t", [], { pageSize: 3 })) {
      pages.push(page)
    }

    expect(pages).toHaveLength(2)
    expect(pages[0].rows.values).toHaveLength(3)
    expect(pages[0].hasMore).toBe(true)
    expect(pages[1].rows.values).toHaveLength(1)
    expect(pages[1].hasMore).toBe(false)
  })
})

describe("toRowsPaginated", () => {
  it("converts page rows to keyed objects", () => {
    const page = {
      rows: {
        columns: ["id", "name"],
        values: [
          [1, "Alice"],
          [2, "Bob"]
        ]
      },
      offset: 0,
      hasMore: true,
      pageSize: 10
    }

    const result = toRowsPaginated(page)

    expect(result.rows).toEqual([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" }
    ])
    expect(result.offset).toBe(0)
    expect(result.hasMore).toBe(true)
    expect(result.pageSize).toBe(10)
  })

  it("handles empty page", () => {
    const page = {
      rows: {
        columns: ["id"],
        values: [] as unknown[][]
      },
      offset: 50,
      hasMore: false,
      pageSize: 25
    }

    const result = toRowsPaginated(page)

    expect(result.rows).toEqual([])
    expect(result.offset).toBe(50)
    expect(result.hasMore).toBe(false)
    expect(result.pageSize).toBe(25)
  })
})
