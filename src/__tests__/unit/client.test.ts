import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createRqliteClient, RqliteClient } from "../../client"
import { AuthenticationError, ConnectionError } from "../../errors"
import { isErr, isOk } from "../../result"

// =============================================================================
// Helpers
// =============================================================================

type MockResponseInit = {
  ok: boolean
  status: number
  data?: unknown
  text?: string
  headers?: Headers
  jsonError?: Error
}

function mockFetch(response: MockResponseInit): ReturnType<typeof vi.fn> {
  const json =
    response.jsonError !== undefined
      ? vi.fn().mockRejectedValue(response.jsonError)
      : vi.fn().mockResolvedValue(response.data ?? {})
  const text = vi.fn().mockResolvedValue(response.text ?? "")
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json,
    text,
    headers: response.headers ?? new Headers()
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

// =============================================================================
// Tests
// =============================================================================

describe("RqliteClient", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe("constructor", () => {
    it("builds HTTP base URL without TLS", () => {
      const fetchMock = mockFetch({ ok: true, status: 200 })
      const client = new RqliteClient({ host: "localhost:4001" })
      void client.get("/status")
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("http://localhost:4001/status"),
        expect.any(Object)
      )
    })

    it("builds HTTPS base URL with TLS", () => {
      const fetchMock = mockFetch({ ok: true, status: 200 })
      const client = new RqliteClient({ host: "localhost:4001", tls: true })
      void client.get("/status")
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("https://localhost:4001/status"),
        expect.any(Object)
      )
    })
  })

  describe("authentication", () => {
    it("sends basic auth header when credentials are provided", async () => {
      const fetchMock = mockFetch({ ok: true, status: 200 })
      const client = new RqliteClient({
        host: "localhost:4001",
        auth: { username: "admin", password: "secret" }
      })

      await client.get("/status")

      const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>
      expect(headers.Authorization).toBe(`Basic ${btoa("admin:secret")}`)
    })

    it("does not send auth header when no credentials", async () => {
      const fetchMock = mockFetch({ ok: true, status: 200 })
      const client = new RqliteClient({ host: "localhost:4001" })

      await client.get("/status")

      const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>
      expect(headers.Authorization).toBeUndefined()
    })

    it("returns AuthenticationError on 401", async () => {
      mockFetch({ ok: false, status: 401 })
      const client = new RqliteClient({ host: "localhost:4001" })

      const result = await client.get("/status")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(AuthenticationError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("unauthorised")
      }
    })

    it("returns AuthenticationError on 403", async () => {
      mockFetch({ ok: false, status: 403 })
      const client = new RqliteClient({ host: "localhost:4001" })

      const result = await client.get("/status")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(AuthenticationError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("forbidden")
      }
    })
  })

  describe("get", () => {
    it("sends a GET request and parses JSON response", async () => {
      const data = { store: { raft: {} } }
      mockFetch({ ok: true, status: 200, data })
      const client = new RqliteClient({ host: "localhost:4001" })

      const result = await client.get("/status")

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(data)
      }
    })

    it("appends query parameters", async () => {
      const fetchMock = mockFetch({ ok: true, status: 200 })
      const client = new RqliteClient({ host: "localhost:4001" })

      await client.get("/status", { ver: "2" })

      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain("ver=2")
    })
  })

  describe("post", () => {
    it("sends a POST request with JSON body", async () => {
      const fetchMock = mockFetch({ ok: true, status: 200 })
      const client = new RqliteClient({ host: "localhost:4001" })
      const body = [["INSERT INTO foo VALUES(?)", 1]]

      await client.post("/db/execute", body)

      const opts = fetchMock.mock.calls[0]?.[1]
      expect(opts?.method).toBe("POST")
      expect(opts?.headers?.["Content-Type"]).toBe("application/json")
      expect(opts?.body).toBe(JSON.stringify(body))
    })

    it("parses JSON response", async () => {
      const responseData = { results: [{ last_insert_id: 1, rows_affected: 1 }] }
      mockFetch({ ok: true, status: 200, data: responseData })
      const client = new RqliteClient({ host: "localhost:4001" })

      const result = await client.post("/db/execute", [])

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(responseData)
      }
    })
  })

  describe("error handling", () => {
    it("returns ConnectionError on HTTP error", async () => {
      mockFetch({ ok: false, status: 500, text: "internal server error" })
      const client = new RqliteClient({ host: "localhost:4001" })

      const result = await client.get("/status")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
        expect(result.error.message).toContain("500")
      }
    })

    it("returns ConnectionError on network error", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")))
      const client = new RqliteClient({ host: "localhost:4001", maxRetries: 0 })

      const result = await client.get("/status")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("network error")
      }
    })

    it("returns ConnectionError on timeout", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
          return new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("signal is aborted", "AbortError"))
            })
          })
        })
      )
      const client = new RqliteClient({ host: "localhost:4001", timeout: 100, maxRetries: 0 })

      const resultPromise = client.get("/status")
      await vi.advanceTimersByTimeAsync(150)
      const result = await resultPromise

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("request timed out")
      }
    })

    it("returns ConnectionError on invalid JSON response", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token")),
        text: vi.fn().mockResolvedValue("not json")
      })
      vi.stubGlobal("fetch", fetchMock)
      const client = new RqliteClient({ host: "localhost:4001" })

      const result = await client.get("/status")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("failed to parse response as JSON")
      }
    })
  })

  describe("timeout", () => {
    it("uses default timeout of 10 seconds", () => {
      const fetchMock = mockFetch({ ok: true, status: 200 })
      const client = new RqliteClient({ host: "localhost:4001" })

      void client.get("/status")

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })

    it("uses configured timeout", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
          return new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("signal is aborted", "AbortError"))
            })
          })
        })
      )
      const client = new RqliteClient({ host: "localhost:4001", timeout: 50, maxRetries: 0 })

      const resultPromise = client.get("/status")
      await vi.advanceTimersByTimeAsync(60)
      const result = await resultPromise

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(result.error.message).toBe("request timed out")
      }
    })
  })
})

describe("createRqliteClient", () => {
  it("returns an RqliteClient instance", () => {
    const client = createRqliteClient({ host: "localhost:4001" })
    expect(client).toBeInstanceOf(RqliteClient)
  })
})

describe("unexpected fetch errors", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("maps non-TypeError non-AbortError to ConnectionError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("some unknown error")))
    const client = new RqliteClient({ host: "localhost:4001", maxRetries: 0 })

    const result = await client.get("/status")

    expect(isErr(result)).toBe(true)
    if (!result.ok) {
      expect(ConnectionError.isError(result.error)).toBe(true)
      expect(result.error.message).toBe("unexpected fetch error")
    }
  })

  it("maps non-Error value to ConnectionError without cause", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("string error"))
    const client = new RqliteClient({ host: "localhost:4001", maxRetries: 0 })

    const result = await client.get("/status")

    expect(isErr(result)).toBe(true)
    if (!result.ok) {
      expect(ConnectionError.isError(result.error)).toBe(true)
      expect(result.error.message).toBe("unexpected fetch error")
    }
  })
})
