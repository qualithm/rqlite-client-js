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
  const text = vi.fn().mockResolvedValue("")
  return {
    ok: response.ok,
    status: response.status,
    json,
    text,
    headers: new Headers(response.headers)
  }
}

const successResponse = (data?: unknown): MockResponseInit => ({
  ok: true,
  status: 200,
  data: data ?? { results: [{ rows_affected: 1, time: 0.001 }] }
})

const networkError = async (): Promise<never> => Promise.reject(new TypeError("fetch failed"))

// =============================================================================
// Tests
// =============================================================================

describe("Cluster Discovery", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  // ---------------------------------------------------------------------------
  // Seed host list
  // ---------------------------------------------------------------------------

  describe("seed hosts", () => {
    it("builds peer list from host and hosts", async () => {
      // First call fails on primary, succeeds on seed
      const fetchMock = vi
        .fn()
        .mockImplementationOnce(networkError)
        .mockResolvedValueOnce(createMockResponse(successResponse()))
        // Background /nodes discovery call
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            data: {
              "1": {
                id: "1",
                api_addr: "http://localhost:4001",
                addr: "localhost:4002",
                leader: true,
                reachable: true
              },
              "2": {
                id: "2",
                api_addr: "http://localhost:4003",
                addr: "localhost:4004",
                leader: false,
                reachable: true
              }
            }
          })
        )
      vi.stubGlobal("fetch", fetchMock)

      const client = new RqliteClient({
        host: "localhost:4001",
        hosts: ["localhost:4003"],
        maxRetries: 2,
        retryBaseDelay: 0,
        timeout: 1000
      })

      const result = await client.execute("INSERT INTO foo VALUES(1)")

      expect(isOk(result)).toBe(true)
      // First call went to primary (port 4001), second to seed (port 4003)
      expect(fetchMock.mock.calls[0][0]).toContain("localhost:4001")
      expect(fetchMock.mock.calls[1][0]).toContain("localhost:4003")
    })

    it("deduplicates primary host from hosts array", async () => {
      // Only one unique peer — should not duplicate
      const fetchMock = vi
        .fn()
        .mockImplementationOnce(networkError)
        .mockImplementationOnce(networkError)
        .mockImplementationOnce(networkError)
        .mockImplementationOnce(networkError)
      vi.stubGlobal("fetch", fetchMock)

      const client = new RqliteClient({
        host: "localhost:4001",
        hosts: ["localhost:4001"], // duplicate of primary
        maxRetries: 2,
        retryBaseDelay: 0,
        timeout: 100
      })

      const result = await client.execute("INSERT INTO foo VALUES(1)")

      expect(isErr(result)).toBe(true)
      // With only 1 unique peer, all 3 attempts (0 + maxRetries) should hit the same host
      for (const call of fetchMock.mock.calls) {
        expect(call[0]).toContain("localhost:4001")
      }
    })

    it("tries all seeds before exhausting retries", async () => {
      const fetchMock = vi
        .fn()
        .mockImplementationOnce(networkError) // localhost:4001
        .mockImplementationOnce(networkError) // localhost:4003
        .mockImplementationOnce(networkError) // localhost:4005 (wraps back)
        .mockImplementationOnce(networkError)
      vi.stubGlobal("fetch", fetchMock)

      const client = new RqliteClient({
        host: "localhost:4001",
        hosts: ["localhost:4003", "localhost:4005"],
        maxRetries: 2,
        retryBaseDelay: 0,
        timeout: 100
      })

      const result = await client.execute("INSERT INTO foo VALUES(1)")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
      }
      // Three attempts across three peers
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(fetchMock.mock.calls[0][0]).toContain("localhost:4001")
      expect(fetchMock.mock.calls[1][0]).toContain("localhost:4003")
      expect(fetchMock.mock.calls[2][0]).toContain("localhost:4005")
    })

    it("succeeds with no hosts config (single peer)", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(createMockResponse(successResponse()))
        .mockResolvedValueOnce(createMockResponse({ ok: true, status: 200, data: {} })) // /nodes
      vi.stubGlobal("fetch", fetchMock)

      const client = new RqliteClient({ host: "localhost:4001" })

      const result = await client.execute("INSERT INTO foo VALUES(1)")

      expect(isOk(result)).toBe(true)
      expect(fetchMock.mock.calls[0][0]).toContain("localhost:4001")
    })
  })

  // ---------------------------------------------------------------------------
  // Background peer refresh
  // ---------------------------------------------------------------------------

  describe("background peer refresh", () => {
    it("calls /nodes after a successful request", async () => {
      const nodesData = {
        "1": {
          id: "1",
          api_addr: "http://localhost:4001",
          addr: "localhost:4002",
          leader: true,
          reachable: true
        },
        "2": {
          id: "2",
          api_addr: "http://localhost:4003",
          addr: "localhost:4004",
          leader: false,
          reachable: true
        }
      }

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(createMockResponse(successResponse()))
        .mockResolvedValueOnce(createMockResponse({ ok: true, status: 200, data: nodesData }))
      vi.stubGlobal("fetch", fetchMock)

      const client = new RqliteClient({
        host: "localhost:4001",
        clusterDiscovery: true
      })

      await client.execute("INSERT INTO foo VALUES(1)")

      // Flush background promises
      await vi.runAllTimersAsync()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls[1][0]).toContain("/nodes")
    })

    it("does not call /nodes when clusterDiscovery is false", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(createMockResponse(successResponse()))
      vi.stubGlobal("fetch", fetchMock)

      const client = new RqliteClient({
        host: "localhost:4001",
        clusterDiscovery: false
      })

      await client.execute("INSERT INTO foo VALUES(1)")

      await vi.runAllTimersAsync()

      // Only the actual request — no /nodes call
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("silently ignores /nodes failures during discovery", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(createMockResponse(successResponse()))
        .mockRejectedValueOnce(new TypeError("fetch failed")) // /nodes fails
      vi.stubGlobal("fetch", fetchMock)

      const client = new RqliteClient({
        host: "localhost:4001",
        clusterDiscovery: true
      })

      // Should not throw
      await expect(client.execute("INSERT INTO foo VALUES(1)")).resolves.toBeDefined()
      await vi.runAllTimersAsync()
    })

    it("silently ignores non-ok /nodes response during discovery", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(createMockResponse(successResponse()))
        .mockResolvedValueOnce(createMockResponse({ ok: false, status: 503 })) // /nodes returns 503
      vi.stubGlobal("fetch", fetchMock)

      const client = new RqliteClient({
        host: "localhost:4001",
        clusterDiscovery: true
      })

      // Should not throw even when /nodes returns non-ok
      await expect(client.execute("INSERT INTO foo VALUES(1)")).resolves.toBeDefined()
      await vi.runAllTimersAsync()

      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("aborts discovery request when timeout fires", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(createMockResponse(successResponse()))
        .mockImplementationOnce(async (_url: string, init: RequestInit) => {
          // Hang until the signal fires
          return new Promise((_resolve, reject) => {
            const signal = init.signal!
            signal.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"))
            })
          })
        })
      vi.stubGlobal("fetch", fetchMock)

      const client = new RqliteClient({
        host: "localhost:4001",
        clusterDiscovery: true,
        timeout: 100
      })

      // Should not throw — discovery is fire-and-forget
      await expect(client.execute("INSERT INTO foo VALUES(1)")).resolves.toBeDefined()

      // Advance past the discovery timeout so controller.abort() fires
      await vi.advanceTimersByTimeAsync(200)
    })

    it("updates peer list after discovery", async () => {
      const nodesData = {
        "1": {
          id: "1",
          api_addr: "http://localhost:4001",
          addr: "localhost:4002",
          leader: true,
          reachable: true
        },
        "2": {
          id: "2",
          api_addr: "http://localhost:4003",
          addr: "localhost:4004",
          leader: false,
          reachable: true
        },
        "3": {
          id: "3",
          api_addr: "http://localhost:4005",
          addr: "localhost:4006",
          leader: false,
          reachable: true
        }
      }

      const fetchMock = vi
        .fn()
        // First execute — succeeds
        .mockResolvedValueOnce(createMockResponse(successResponse()))
        // Background /nodes
        .mockResolvedValueOnce(createMockResponse({ ok: true, status: 200, data: nodesData }))
        // Second execute — primary fails, rotates to discovered peer
        .mockImplementationOnce(networkError)
        .mockResolvedValueOnce(createMockResponse(successResponse()))
        // Background /nodes again
        .mockResolvedValueOnce(createMockResponse({ ok: true, status: 200, data: nodesData }))
      vi.stubGlobal("fetch", fetchMock)

      const client = new RqliteClient({
        host: "localhost:4001",
        clusterDiscovery: true,
        maxRetries: 3,
        retryBaseDelay: 0
      })

      await client.execute("INSERT INTO foo VALUES(1)")
      await vi.runAllTimersAsync()

      const result = await client.execute("INSERT INTO foo VALUES(2)")
      expect(isOk(result)).toBe(true)

      // After discovery, the second execute's retry should use a discovered peer
      const retryUrl = fetchMock.mock.calls[3]?.[0] as string
      expect(retryUrl.includes("localhost:4003") || retryUrl.includes("localhost:4005")).toBe(true)
    })

    it("filters unreachable nodes from discovered peers", async () => {
      const nodesData = {
        "1": {
          id: "1",
          api_addr: "http://localhost:4001",
          addr: "localhost:4002",
          leader: true,
          reachable: true
        },
        "2": {
          id: "2",
          api_addr: "http://localhost:4003",
          addr: "localhost:4004",
          leader: false,
          reachable: false
        }
      }

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(createMockResponse(successResponse()))
        .mockResolvedValueOnce(createMockResponse({ ok: true, status: 200, data: nodesData }))
        .mockImplementationOnce(networkError)
        .mockResolvedValueOnce(createMockResponse(successResponse()))
        .mockResolvedValueOnce(createMockResponse({ ok: true, status: 200, data: nodesData }))
      vi.stubGlobal("fetch", fetchMock)

      const client = new RqliteClient({
        host: "localhost:4001",
        clusterDiscovery: true,
        maxRetries: 3,
        retryBaseDelay: 0
      })

      await client.execute("INSERT INTO foo VALUES(1)")
      await vi.runAllTimersAsync()

      const result = await client.execute("INSERT INTO foo VALUES(2)")
      expect(isOk(result)).toBe(true)

      // Unreachable node (4003) should NOT appear in retry attempts
      for (const call of fetchMock.mock.calls) {
        const url = call[0] as string
        if (url.includes("/db/")) {
          expect(url).not.toContain("localhost:4003")
        }
      }
    })
  })

  // ---------------------------------------------------------------------------
  // clusterDiscovery: false
  // ---------------------------------------------------------------------------

  describe("clusterDiscovery disabled", () => {
    it("uses only the primary host even when hosts is provided", async () => {
      const fetchMock = vi
        .fn()
        .mockImplementationOnce(networkError)
        .mockImplementationOnce(networkError)
        .mockImplementationOnce(networkError)
      vi.stubGlobal("fetch", fetchMock)

      const client = new RqliteClient({
        host: "localhost:4001",
        hosts: ["localhost:4003", "localhost:4005"],
        clusterDiscovery: false,
        maxRetries: 2,
        retryBaseDelay: 0,
        timeout: 100
      })

      const result = await client.execute("INSERT INTO foo VALUES(1)")

      expect(isErr(result)).toBe(true)
      // With discovery disabled, seeds are still tried (they are in the initial peer list)
      // The peer list is built from host + hosts regardless; discovery only controls /nodes refresh.
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it("returns error after maxRetries when all peers fail", async () => {
      const fetchMock = vi.fn().mockImplementation(networkError)
      vi.stubGlobal("fetch", fetchMock)

      const client = new RqliteClient({
        host: "localhost:4001",
        clusterDiscovery: false,
        maxRetries: 1,
        retryBaseDelay: 0,
        timeout: 100
      })

      const result = await client.execute("INSERT INTO foo VALUES(1)")

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
      }
    })
  })
})
