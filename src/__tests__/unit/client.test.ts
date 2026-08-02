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

/** Stub `fetch` with one response per call, repeating the last once exhausted. */
function mockFetchSequence(responses: MockResponseInit[]): ReturnType<typeof vi.fn> {
  let call = 0
  const fetchMock = vi.fn().mockImplementation(async () => {
    const response = responses[Math.min(call, responses.length - 1)]
    call++
    return Promise.resolve({
      ok: response.ok,
      status: response.status,
      json: vi.fn().mockResolvedValue(response.data ?? {}),
      text: vi.fn().mockResolvedValue(response.text ?? ""),
      headers: response.headers ?? new Headers()
    })
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

  describe("custom fetch", () => {
    it("uses custom fetch when provided", async () => {
      const customFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ store: {} }),
        text: vi.fn().mockResolvedValue(""),
        headers: new Headers()
      }) as unknown as typeof fetch

      const client = new RqliteClient({
        host: "localhost:4001",
        fetch: customFetch,
        clusterDiscovery: false
      })

      await client.get("/status")

      expect(customFetch).toHaveBeenCalledTimes(1)
      expect(customFetch).toHaveBeenCalledWith(
        expect.stringContaining("http://localhost:4001/status"),
        expect.any(Object)
      )
    })

    it("passes headers and body through custom fetch", async () => {
      const customFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ results: [{ last_insert_id: 1, rows_affected: 1 }] }),
        text: vi.fn().mockResolvedValue(""),
        headers: new Headers()
      }) as unknown as typeof fetch

      const client = new RqliteClient({
        host: "localhost:4001",
        auth: { username: "admin", password: "secret" },
        fetch: customFetch
      })

      await client.execute("INSERT INTO foo VALUES(1)")

      const opts = (customFetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]
      expect(opts?.headers?.Authorization).toBe(`Basic ${btoa("admin:secret")}`)
      expect(opts?.headers?.["Content-Type"]).toBe("application/json")
      expect(opts?.body).toBeDefined()
    })

    it("falls back to global fetch when not provided", async () => {
      const globalFetchMock = mockFetch({ ok: true, status: 200 })
      const client = new RqliteClient({ host: "localhost:4001", clusterDiscovery: false })

      await client.get("/status")

      expect(globalFetchMock).toHaveBeenCalledTimes(1)
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
        expect(result.error.message).toBe("unauthorized")
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

  describe("authProvider", () => {
    function basic(username: string, password: string): string {
      return `Basic ${btoa(`${username}:${password}`)}`
    }

    function authOf(mock: ReturnType<typeof vi.fn>, call: number): string | undefined {
      const headers = mock.mock.calls[call]?.[1]?.headers as Record<string, string> | undefined
      return headers?.Authorization
    }

    it("resolves credentials from the provider", async () => {
      const fetchMock = mockFetch({ ok: true, status: 200 })
      const client = new RqliteClient({
        host: "localhost:4001",
        authProvider: () => ({ username: "admin", password: "secret" }),
        clusterDiscovery: false
      })

      await client.get("/status")

      expect(authOf(fetchMock, 0)).toBe(basic("admin", "secret"))
    })

    it("awaits an async provider", async () => {
      const fetchMock = mockFetch({ ok: true, status: 200 })
      const client = new RqliteClient({
        host: "localhost:4001",
        authProvider: async () => Promise.resolve({ username: "async", password: "pw" }),
        clusterDiscovery: false
      })

      await client.get("/status")

      expect(authOf(fetchMock, 0)).toBe(basic("async", "pw"))
    })

    it("takes precedence over static auth", async () => {
      const fetchMock = mockFetch({ ok: true, status: 200 })
      const client = new RqliteClient({
        host: "localhost:4001",
        auth: { username: "static", password: "old" },
        authProvider: () => ({ username: "rotated", password: "new" }),
        clusterDiscovery: false
      })

      await client.get("/status")

      expect(authOf(fetchMock, 0)).toBe(basic("rotated", "new"))
    })

    it("caches the resolved credential across requests", async () => {
      mockFetch({ ok: true, status: 200 })
      const provider = vi.fn().mockReturnValue({ username: "admin", password: "secret" })
      const client = new RqliteClient({
        host: "localhost:4001",
        authProvider: provider,
        clusterDiscovery: false
      })

      await client.get("/status")
      await client.get("/status")
      await client.get("/status")

      expect(provider).toHaveBeenCalledTimes(1)
    })

    it("re-resolves and retries once on 401", async () => {
      const fetchMock = mockFetchSequence([
        { ok: false, status: 401 },
        { ok: true, status: 200, data: { store: {} } }
      ])
      const provider = vi
        .fn()
        .mockReturnValueOnce({ username: "admin", password: "old" })
        .mockReturnValueOnce({ username: "admin", password: "new" })
      const client = new RqliteClient({
        host: "localhost:4001",
        authProvider: provider,
        clusterDiscovery: false
      })

      const result = await client.get("/status")

      expect(isOk(result)).toBe(true)
      expect(provider).toHaveBeenCalledTimes(2)
      expect(authOf(fetchMock, 0)).toBe(basic("admin", "old"))
      expect(authOf(fetchMock, 1)).toBe(basic("admin", "new"))
    })

    it("retries at most once when the fresh credential is also rejected", async () => {
      const fetchMock = mockFetchSequence([
        { ok: false, status: 401 },
        { ok: false, status: 401 }
      ])
      const client = new RqliteClient({
        host: "localhost:4001",
        authProvider: () => ({ username: "admin", password: "stale" }),
        clusterDiscovery: false
      })

      const result = await client.get("/status")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(AuthenticationError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("unauthorized")
      }
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("does not retry a 403", async () => {
      const fetchMock = mockFetch({ ok: false, status: 403 })
      const provider = vi.fn().mockReturnValue({ username: "admin", password: "secret" })
      const client = new RqliteClient({
        host: "localhost:4001",
        authProvider: provider,
        clusterDiscovery: false
      })

      const result = await client.get("/status")

      expect(isErr(result)).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(provider).toHaveBeenCalledTimes(1)
    })

    it("collapses concurrent refreshes into a single provider call", async () => {
      mockFetchSequence([
        { ok: false, status: 401 },
        { ok: false, status: 401 },
        { ok: true, status: 200, data: { store: {} } },
        { ok: true, status: 200, data: { store: {} } }
      ])
      const provider = vi.fn().mockResolvedValue({ username: "admin", password: "secret" })
      const client = new RqliteClient({
        host: "localhost:4001",
        authProvider: provider,
        clusterDiscovery: false
      })

      await Promise.all([client.get("/status"), client.get("/status")])

      // One initial resolve plus one shared refresh, not one refresh per rejected request.
      expect(provider).toHaveBeenCalledTimes(2)
    })

    it("does not invoke the provider when only static auth is configured", async () => {
      const fetchMock = mockFetch({ ok: true, status: 200 })
      const client = new RqliteClient({
        host: "localhost:4001",
        auth: { username: "admin", password: "secret" },
        clusterDiscovery: false
      })

      await client.get("/status")

      expect(authOf(fetchMock, 0)).toBe(basic("admin", "secret"))
    })

    it("re-resolves and retries once on 401 from a text endpoint", async () => {
      const fetchMock = mockFetchSequence([
        { ok: false, status: 401 },
        { ok: true, status: 200, text: "[+]node ok\n[Leader]" }
      ])
      const provider = vi
        .fn()
        .mockReturnValueOnce({ username: "admin", password: "old" })
        .mockReturnValueOnce({ username: "admin", password: "new" })
      const client = new RqliteClient({
        host: "localhost:4001",
        authProvider: provider,
        clusterDiscovery: false
      })

      const result = await client.ready()

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.ready).toBe(true)
        expect(result.value.isLeader).toBe(true)
      }
      expect(authOf(fetchMock, 1)).toBe(basic("admin", "new"))
    })

    it("returns AuthenticationError from a text endpoint when the refresh does not help", async () => {
      mockFetchSequence([
        { ok: false, status: 401 },
        { ok: false, status: 401 }
      ])
      const client = new RqliteClient({
        host: "localhost:4001",
        authProvider: () => ({ username: "admin", password: "stale" }),
        clusterDiscovery: false
      })

      const result = await client.ready()

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(result.error.message).toBe("unauthorized")
      }
    })

    it("sends the provider credential on background peer discovery", async () => {
      const fetchMock = mockFetch({ ok: true, status: 200, data: { nodes: [] } })
      const client = new RqliteClient({
        host: "localhost:4001",
        authProvider: () => ({ username: "admin", password: "secret" }),
        clusterDiscovery: true
      })

      await client.get("/status")
      await vi.advanceTimersByTimeAsync(0)

      const discovery = fetchMock.mock.calls.find(([url]) => String(url).includes("/nodes"))
      const headers = discovery?.[1]?.headers as Record<string, string> | undefined
      expect(headers?.Authorization).toBe(basic("admin", "secret"))
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
