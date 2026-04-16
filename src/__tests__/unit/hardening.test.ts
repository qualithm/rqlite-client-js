import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { RqliteClient } from "../../client"
import { ConnectionError } from "../../errors"
import { isErr, isOk } from "../../result"

// =============================================================================
// Helpers
// =============================================================================

type MockResponseInit = {
  ok: boolean
  status: number
  data?: unknown
  text?: string
  headers?: Record<string, string>
}

function createMockResponse(response: MockResponseInit): {
  ok: boolean
  status: number
  json: ReturnType<typeof vi.fn>
  text: ReturnType<typeof vi.fn>
  headers: Headers
} {
  const json = vi.fn().mockResolvedValue(response.data ?? {})
  const text = vi.fn().mockResolvedValue(response.text ?? "")
  return {
    ok: response.ok,
    status: response.status,
    json,
    text,
    headers: new Headers(response.headers)
  }
}

function mockFetch(response: MockResponseInit): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(createMockResponse(response))
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

describe("client hardening", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  // ===========================================================================
  // AbortSignal support
  // ===========================================================================

  describe("user-supplied AbortSignal", () => {
    it("aborts request when caller signal is triggered", async () => {
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
      const client = createClient({ maxRetries: 0 })
      const controller = new AbortController()

      const resultPromise = client.execute("INSERT INTO foo VALUES(1)", undefined, {
        signal: controller.signal
      })

      // Abort after a short delay
      await vi.advanceTimersByTimeAsync(10)
      controller.abort()
      await vi.advanceTimersByTimeAsync(10)

      const result = await resultPromise

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("request timed out")
      }
    })

    it("aborts query when caller signal is triggered", async () => {
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
      const client = createClient({ maxRetries: 0 })
      const controller = new AbortController()

      const resultPromise = client.query("SELECT * FROM foo", undefined, {
        signal: controller.signal
      })

      await vi.advanceTimersByTimeAsync(10)
      controller.abort()
      await vi.advanceTimersByTimeAsync(10)

      const result = await resultPromise

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
      }
    })

    it("fails immediately when signal is already aborted", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
          return new Promise((_resolve, reject) => {
            if (init.signal?.aborted === true) {
              reject(new DOMException("signal is aborted", "AbortError"))
              return
            }
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("signal is aborted", "AbortError"))
            })
          })
        })
      )
      const client = createClient({ maxRetries: 0 })
      const controller = new AbortController()
      controller.abort() // Already aborted

      const resultPromise = client.execute("INSERT INTO foo VALUES(1)", undefined, {
        signal: controller.signal
      })
      await vi.advanceTimersByTimeAsync(10)
      const result = await resultPromise

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
      }
    })

    it("threads signal through requestBatch", async () => {
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
      const client = createClient({ maxRetries: 0 })
      const controller = new AbortController()

      const resultPromise = client.requestBatch(
        [["INSERT INTO foo VALUES(1)"], ["SELECT * FROM foo"]],
        { signal: controller.signal }
      )

      await vi.advanceTimersByTimeAsync(10)
      controller.abort()
      await vi.advanceTimersByTimeAsync(10)

      const result = await resultPromise

      expect(isErr(result)).toBe(true)
    })

    it("threads signal through ready()", async () => {
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
      const client = createClient({ maxRetries: 0 })
      const controller = new AbortController()

      const resultPromise = client.ready({ signal: controller.signal })

      await vi.advanceTimersByTimeAsync(10)
      controller.abort()
      await vi.advanceTimersByTimeAsync(10)

      const result = await resultPromise

      expect(isErr(result)).toBe(true)
    })
  })

  // ===========================================================================
  // Redirect URL validation
  // ===========================================================================

  describe("redirect URL validation", () => {
    it("rejects redirect to non-HTTP URL", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 301,
          headers: { Location: "file:///etc/passwd" }
        })
      )
      vi.stubGlobal("fetch", fetchMock)
      const client = createClient()

      const result = await client.execute("INSERT INTO foo VALUES(1)")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("redirect to disallowed URL")
      }
      // Should not follow the redirect
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("rejects redirect to javascript: URL", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 301,
          headers: { Location: "javascript:alert(1)" }
        })
      )
      vi.stubGlobal("fetch", fetchMock)
      const client = createClient()

      const result = await client.execute("INSERT INTO foo VALUES(1)")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(result.error.message).toBe("redirect to disallowed URL")
      }
    })

    it("rejects redirect to FTP URL", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 307,
          headers: { Location: "ftp://evil.example.com/data" }
        })
      )
      vi.stubGlobal("fetch", fetchMock)
      const client = createClient()

      const result = await client.execute("INSERT INTO foo VALUES(1)")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(result.error.message).toBe("redirect to disallowed URL")
      }
    })

    it("allows redirect to HTTP URL for non-TLS client", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({
            ok: false,
            status: 301,
            headers: { Location: "http://leader:4001/db/execute" }
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            data: { results: [{ rows_affected: 1, time: 0.001 }] }
          })
        )
      vi.stubGlobal("fetch", fetchMock)
      const client = createClient()

      const resultPromise = client.execute("INSERT INTO foo VALUES(1)")
      await vi.advanceTimersByTimeAsync(200)
      const result = await resultPromise

      expect(isOk(result)).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("allows redirect to HTTPS URL for non-TLS client", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({
            ok: false,
            status: 301,
            headers: { Location: "https://leader:4001/db/execute" }
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            data: { results: [{ rows_affected: 1, time: 0.001 }] }
          })
        )
      vi.stubGlobal("fetch", fetchMock)
      const client = createClient()

      const resultPromise = client.execute("INSERT INTO foo VALUES(1)")
      await vi.advanceTimersByTimeAsync(200)
      const result = await resultPromise

      expect(isOk(result)).toBe(true)
    })

    it("rejects redirect to HTTP URL for TLS client", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 301,
          headers: { Location: "http://leader:4001/db/execute" }
        })
      )
      vi.stubGlobal("fetch", fetchMock)
      const client = createClient({ tls: true })

      const result = await client.execute("INSERT INTO foo VALUES(1)")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(result.error.message).toBe("redirect to disallowed URL")
      }
    })

    it("allows redirect to HTTPS URL for TLS client", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({
            ok: false,
            status: 301,
            headers: { Location: "https://leader:4001/db/execute" }
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            data: { results: [{ rows_affected: 1, time: 0.001 }] }
          })
        )
      vi.stubGlobal("fetch", fetchMock)
      const client = createClient({ tls: true })

      const resultPromise = client.execute("INSERT INTO foo VALUES(1)")
      await vi.advanceTimersByTimeAsync(200)
      const result = await resultPromise

      expect(isOk(result)).toBe(true)
    })

    it("rejects redirect with invalid URL", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 301,
          headers: { Location: "not-a-valid-url" }
        })
      )
      vi.stubGlobal("fetch", fetchMock)
      const client = createClient()

      const result = await client.execute("INSERT INTO foo VALUES(1)")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(result.error.message).toBe("redirect to disallowed URL")
      }
    })
  })

  // ===========================================================================
  // UTF-8 basic auth
  // ===========================================================================

  describe("UTF-8 basic auth", () => {
    it("handles ASCII credentials", async () => {
      const fetchMock = mockFetch({ ok: true, status: 200 })
      const client = createClient({
        auth: { username: "admin", password: "secret" }
      })

      await client.get("/status")

      const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>
      // Standard base64 encoding of "admin:secret"
      expect(headers.Authorization).toBe(`Basic ${btoa("admin:secret")}`)
    })

    it("handles non-ASCII credentials without throwing", async () => {
      const fetchMock = mockFetch({ ok: true, status: 200 })
      const client = createClient({
        auth: { username: "admin", password: "contraseña" }
      })

      await client.get("/status")

      const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>
      expect(headers.Authorization).toMatch(/^Basic /)
      // Should not throw (btoa would throw on raw non-ASCII)
    })

    it("handles emoji credentials without throwing", async () => {
      const fetchMock = mockFetch({ ok: true, status: 200 })
      const client = createClient({
        auth: { username: "user", password: "🔐pass" }
      })

      await client.get("/status")

      const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>
      expect(headers.Authorization).toMatch(/^Basic /)
    })

    it("encodes non-ASCII using UTF-8 bytes", async () => {
      const fetchMock = mockFetch({ ok: true, status: 200 })
      const client = createClient({
        auth: { username: "admin", password: "pässwörd" }
      })

      await client.get("/status")

      const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>
      const encoded = headers.Authorization.replace("Basic ", "")
      // Decode the base64 to verify the UTF-8 bytes were encoded
      const decoded = atob(encoded)
      // Re-construct the original string from UTF-8 bytes
      const bytes = new Uint8Array(decoded.length)
      for (let i = 0; i < decoded.length; i++) {
        bytes[i] = decoded.charCodeAt(i)
      }
      const original = new TextDecoder().decode(bytes)
      expect(original).toBe("admin:pässwörd")
    })
  })

  // ===========================================================================
  // requestText retry/redirect
  // ===========================================================================

  describe("requestText retry and redirect", () => {
    it("retries ready() on transient network failure", async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            text: "[Leader]"
          })
        )
      vi.stubGlobal("fetch", fetchMock)
      const client = createClient()

      const resultPromise = client.ready()
      await vi.advanceTimersByTimeAsync(500)
      const result = await resultPromise

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.ready).toBe(true)
        expect(result.value.isLeader).toBe(true)
      }
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("follows redirect on ready() endpoint", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({
            ok: false,
            status: 301,
            headers: { Location: "http://leader:4001/readyz" }
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            text: "[Leader]"
          })
        )
      vi.stubGlobal("fetch", fetchMock)
      const client = createClient()

      const resultPromise = client.ready()
      await vi.advanceTimersByTimeAsync(200)
      const result = await resultPromise

      expect(isOk(result)).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      const secondUrl = fetchMock.mock.calls[1]?.[0] as string
      expect(secondUrl).toContain("leader:4001")
    })

    it("returns last error after all retries exhausted on ready()", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"))
      vi.stubGlobal("fetch", fetchMock)
      const client = createClient({ maxRetries: 1 })

      const resultPromise = client.ready()
      await vi.advanceTimersByTimeAsync(5000)
      const result = await resultPromise

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("network error")
      }
      // 1 initial + 1 retry = 2 total
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("validates redirect URLs on requestText path", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 301,
          headers: { Location: "file:///etc/passwd" }
        })
      )
      vi.stubGlobal("fetch", fetchMock)
      const client = createClient()

      const result = await client.ready()

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(result.error.message).toBe("redirect to disallowed URL")
      }
    })
  })

  // ===========================================================================
  // Client destroy / lifecycle
  // ===========================================================================

  describe("client destroy", () => {
    it("reports destroyed state", () => {
      const client = createClient()
      expect(client.destroyed).toBe(false)
      client.destroy()
      expect(client.destroyed).toBe(true)
    })

    it("returns error on request after destroy", async () => {
      mockFetch({ ok: true, status: 200 })
      const client = createClient()
      client.destroy()

      const result = await client.execute("INSERT INTO foo VALUES(1)")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("client is destroyed")
      }
    })

    it("returns error on query after destroy", async () => {
      mockFetch({ ok: true, status: 200 })
      const client = createClient()
      client.destroy()

      const result = await client.query("SELECT * FROM foo")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(result.error.message).toBe("client is destroyed")
      }
    })

    it("returns error on ready() after destroy", async () => {
      mockFetch({ ok: true, status: 200, text: "[Leader]" })
      const client = createClient()
      client.destroy()

      const result = await client.ready()

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(result.error.message).toBe("client is destroyed")
      }
    })

    it("aborts in-flight request on destroy", async () => {
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
      const client = createClient({ maxRetries: 0 })

      const resultPromise = client.execute("INSERT INTO foo VALUES(1)")

      await vi.advanceTimersByTimeAsync(10)
      client.destroy()
      await vi.advanceTimersByTimeAsync(10)

      const result = await resultPromise

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
      }
    })

    it("does not make network call after destroy", async () => {
      const fetchMock = mockFetch({ ok: true, status: 200 })
      const client = createClient()
      client.destroy()

      await client.get("/status")

      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
