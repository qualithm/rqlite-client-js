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
  return new RqliteClient({ host: "localhost:4001", ...options })
}

// =============================================================================
// Tests
// =============================================================================

describe("RqliteClient leader handling", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe("redirect following", () => {
    it("follows 301 redirect to leader", async () => {
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
      const secondUrl = fetchMock.mock.calls[1]?.[0] as string
      expect(secondUrl).toBe("http://leader:4001/db/execute")
    })

    it("follows 307 redirect to leader", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({
            ok: false,
            status: 307,
            headers: { Location: "http://leader:4001/db/query" }
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            data: {
              results: [{ columns: ["id"], types: ["integer"], values: [[1]], time: 0.001 }]
            }
          })
        )
      vi.stubGlobal("fetch", fetchMock)
      const client = createClient()

      const resultPromise = client.query("SELECT * FROM foo")
      await vi.advanceTimersByTimeAsync(200)
      const result = await resultPromise

      expect(isOk(result)).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      const secondUrl = fetchMock.mock.calls[1]?.[0] as string
      expect(secondUrl).toBe("http://leader:4001/db/query")
    })

    it("follows multiple redirects up to maxRedirects", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({
            ok: false,
            status: 301,
            headers: { Location: "http://node2:4001/db/execute" }
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            ok: false,
            status: 301,
            headers: { Location: "http://node3:4001/db/execute" }
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
      const client = createClient({ maxRedirects: 3 })

      const resultPromise = client.execute("INSERT INTO foo VALUES(1)")
      await vi.advanceTimersByTimeAsync(1000)
      const result = await resultPromise

      expect(isOk(result)).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it("returns error when max redirects exceeded", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 301,
          headers: { Location: "http://other:4001/db/execute" }
        })
      )
      vi.stubGlobal("fetch", fetchMock)
      const client = createClient({ maxRedirects: 2 })

      const resultPromise = client.execute("INSERT INTO foo VALUES(1)")
      await vi.advanceTimersByTimeAsync(5000)
      const result = await resultPromise

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("leader redirect")
      }
      // 1 initial + 2 redirects = 3 total
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it("redirects do not consume retry budget", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({
            ok: false,
            status: 301,
            headers: { Location: "http://node2:4001/db/execute" }
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            ok: false,
            status: 301,
            headers: { Location: "http://node3:4001/db/execute" }
          })
        )
        // Network failure after redirects — uses retry budget
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            data: { results: [{ rows_affected: 1, time: 0.001 }] }
          })
        )
      vi.stubGlobal("fetch", fetchMock)
      vi.spyOn(Math, "random").mockReturnValue(0.5)
      const client = createClient({ maxRetries: 1, maxRedirects: 5 })

      const resultPromise = client.execute("INSERT INTO foo VALUES(1)")
      await vi.advanceTimersByTimeAsync(5000)
      const result = await resultPromise

      expect(isOk(result)).toBe(true)
      // 2 redirects + 1 failure + 1 success = 4 total
      expect(fetchMock).toHaveBeenCalledTimes(4)
    })

    it("does not follow redirects when followRedirects is false", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 301,
          headers: { Location: "http://leader:4001/db/execute" }
        })
      )
      vi.stubGlobal("fetch", fetchMock)
      const client = createClient({ followRedirects: false })

      const result = await client.execute("INSERT INTO foo VALUES(1)")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
        expect(result.error.message).toContain("301")
      }
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("treats redirect without Location header as connection error", async () => {
      mockFetch({
        ok: false,
        status: 301
      })
      const client = createClient()

      const result = await client.execute("INSERT INTO foo VALUES(1)")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
        expect(result.error.message).toContain("301")
      }
    })
  })

  describe("retry on transient failure", () => {
    it("retries on network error and succeeds", async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new TypeError("fetch failed"))
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
      await vi.advanceTimersByTimeAsync(500)
      const result = await resultPromise

      expect(isOk(result)).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("retries on timeout and succeeds", async () => {
      let callCount = 0
      const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        callCount++
        if (callCount === 1) {
          return new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("signal is aborted", "AbortError"))
            })
          })
        }
        return createMockResponse({
          ok: true,
          status: 200,
          data: { results: [{ rows_affected: 1, time: 0.001 }] }
        })
      })
      vi.stubGlobal("fetch", fetchMock)
      const client = createClient({ timeout: 100 })

      const resultPromise = client.execute("INSERT INTO foo VALUES(1)")
      // First: timeout fires at 100ms, then retry backoff ~100ms, then immediate success
      await vi.advanceTimersByTimeAsync(500)
      const result = await resultPromise

      expect(isOk(result)).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("returns last error after all retries exhausted", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"))
      vi.stubGlobal("fetch", fetchMock)
      const client = createClient({ maxRetries: 2 })

      const resultPromise = client.execute("INSERT INTO foo VALUES(1)")
      await vi.advanceTimersByTimeAsync(5000)
      const result = await resultPromise

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("network error")
      }
      // 1 initial + 2 retries = 3 total
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })
  })

  describe("exponential backoff", () => {
    it("applies jittered exponential backoff between retries", async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            data: { results: [{ rows_affected: 1, time: 0.001 }] }
          })
        )
      vi.stubGlobal("fetch", fetchMock)
      // Mock random to return 0.5 → jitter multiplier = 0.5 + 0.5*0.5 = 0.75
      vi.spyOn(Math, "random").mockReturnValue(0.5)
      const client = createClient({ retryBaseDelay: 100, maxRetries: 3 })

      const resultPromise = client.execute("INSERT INTO foo VALUES(1)")

      // After first failure, should wait ~75ms (100 * 2^0 * 0.75 = 75)
      await vi.advanceTimersByTimeAsync(50)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(30)
      expect(fetchMock).toHaveBeenCalledTimes(2)

      // After second failure, should wait ~150ms (100 * 2^1 * 0.75 = 150)
      await vi.advanceTimersByTimeAsync(100)
      expect(fetchMock).toHaveBeenCalledTimes(2)

      await vi.advanceTimersByTimeAsync(60)
      expect(fetchMock).toHaveBeenCalledTimes(3)

      const result = await resultPromise
      expect(isOk(result)).toBe(true)
    })

    it("uses custom retryBaseDelay", async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            data: { results: [{ rows_affected: 1, time: 0.001 }] }
          })
        )
      vi.stubGlobal("fetch", fetchMock)
      // Mock random to return 1.0 → jitter multiplier = 0.5 + 0.5*1.0 = 1.0 (no jitter)
      vi.spyOn(Math, "random").mockReturnValue(1.0)
      const client = createClient({ retryBaseDelay: 50 })

      const resultPromise = client.execute("INSERT INTO foo VALUES(1)")

      // Should wait 50ms (50 * 2^0 * 1.0) before first retry
      await vi.advanceTimersByTimeAsync(30)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(25)
      expect(fetchMock).toHaveBeenCalledTimes(2)

      const result = await resultPromise
      expect(isOk(result)).toBe(true)
    })
  })

  describe("configuration defaults", () => {
    it("defaults followRedirects to true", async () => {
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
      const client = createClient() // no followRedirects specified

      const resultPromise = client.execute("INSERT INTO foo VALUES(1)")
      await vi.advanceTimersByTimeAsync(500)
      const result = await resultPromise

      expect(isOk(result)).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("defaults maxRetries to 3", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"))
      vi.stubGlobal("fetch", fetchMock)
      const client = createClient() // no maxRetries specified

      const resultPromise = client.execute("INSERT INTO foo VALUES(1)")
      await vi.advanceTimersByTimeAsync(10_000)
      const result = await resultPromise

      expect(isErr(result)).toBe(true)
      // 1 initial + 3 retries = 4 total
      expect(fetchMock).toHaveBeenCalledTimes(4)
    })

    it("does not retry non-retriable errors (401)", async () => {
      mockFetch({ ok: false, status: 401 })
      const client = createClient()

      const result = await client.get("/status")

      expect(isErr(result)).toBe(true)
      const fetchFn = vi.mocked(globalThis.fetch)
      expect(fetchFn).toHaveBeenCalledTimes(1)
    })

    it("does not retry non-retriable errors (500)", async () => {
      mockFetch({ ok: false, status: 500, text: "internal server error" })
      const client = createClient()

      const result = await client.get("/status")

      expect(isErr(result)).toBe(true)
      const fetchFn = vi.mocked(globalThis.fetch)
      expect(fetchFn).toHaveBeenCalledTimes(1)
    })

    it("sets maxRetries to 0 to disable retries", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"))
      vi.stubGlobal("fetch", fetchMock)
      const client = createClient({ maxRetries: 0 })

      const resultPromise = client.execute("INSERT INTO foo VALUES(1)")
      await vi.advanceTimersByTimeAsync(1000)
      const result = await resultPromise

      expect(isErr(result)).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })
})
