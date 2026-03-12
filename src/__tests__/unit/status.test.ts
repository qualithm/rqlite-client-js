import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { RqliteClient } from "../../client"
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

describe("Cluster Status", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe("status()", () => {
    it("returns status object on success", async () => {
      const statusData = {
        build: { version: "v8.0.0", branch: "master", commit: "abc123" },
        http: { addr: "localhost:4001", auth: "disabled" },
        store: { raft: { state: "Leader" } }
      }
      mockFetch({ ok: true, status: 200, data: statusData })
      const client = new RqliteClient({ host: "localhost:4001" })

      const result = await client.status()

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(statusData)
      }
    })

    it("calls GET /status endpoint", async () => {
      const fetchMock = mockFetch({ ok: true, status: 200, data: {} })
      const client = new RqliteClient({ host: "localhost:4001" })

      await client.status()

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4001/status",
        expect.objectContaining({ method: "GET" })
      )
    })

    it("returns AuthenticationError on 401", async () => {
      mockFetch({ ok: false, status: 401 })
      const client = new RqliteClient({ host: "localhost:4001", maxRetries: 0 })

      const result = await client.status()

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(AuthenticationError.isError(result.error)).toBe(true)
      }
    })

    it("returns ConnectionError on network error", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")))
      const client = new RqliteClient({ host: "localhost:4001", maxRetries: 0 })

      const result = await client.status()

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
      }
    })
  })

  describe("ready()", () => {
    it("returns ready with isLeader true when node is leader", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue("[Leader]")
      })
      vi.stubGlobal("fetch", fetchMock)
      const client = new RqliteClient({ host: "localhost:4001" })

      const result = await client.ready()

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.ready).toBe(true)
        expect(result.value.isLeader).toBe(true)
      }
    })

    it("returns ready with isLeader false when node is not leader", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue("[Not Leader]")
      })
      vi.stubGlobal("fetch", fetchMock)
      const client = new RqliteClient({ host: "localhost:4001" })

      const result = await client.ready()

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.ready).toBe(true)
        expect(result.value.isLeader).toBe(false)
      }
    })

    it("returns not ready when node returns 503", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue("[Not Leader]")
      })
      vi.stubGlobal("fetch", fetchMock)
      const client = new RqliteClient({ host: "localhost:4001" })

      const result = await client.ready()

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value.ready).toBe(false)
        expect(result.value.isLeader).toBe(false)
      }
    })

    it("calls GET /readyz endpoint", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue("[Leader]")
      })
      vi.stubGlobal("fetch", fetchMock)
      const client = new RqliteClient({ host: "localhost:4001" })

      await client.ready()

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4001/readyz",
        expect.objectContaining({ method: "GET" })
      )
    })

    it("passes noleader query parameter", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue("[Leader]")
      })
      vi.stubGlobal("fetch", fetchMock)
      const client = new RqliteClient({ host: "localhost:4001" })

      await client.ready({ noleader: true })

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4001/readyz?noleader=",
        expect.objectContaining({ method: "GET" })
      )
    })

    it("returns AuthenticationError on 401", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue("")
      })
      vi.stubGlobal("fetch", fetchMock)
      const client = new RqliteClient({ host: "localhost:4001" })

      const result = await client.ready()

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(AuthenticationError.isError(result.error)).toBe(true)
      }
    })

    it("returns ConnectionError on network error", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")))
      const client = new RqliteClient({ host: "localhost:4001" })

      const result = await client.ready()

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
      }
    })

    it("returns AuthenticationError on 403", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: vi.fn().mockResolvedValue("")
      })
      vi.stubGlobal("fetch", fetchMock)
      const client = new RqliteClient({ host: "localhost:4001" })

      const result = await client.ready()

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(AuthenticationError.isError(result.error)).toBe(true)
      }
    })
    it("sends auth header on readyz endpoint when credentials are provided", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue("[Leader]")
      })
      vi.stubGlobal("fetch", fetchMock)
      const client = new RqliteClient({
        host: "localhost:4001",
        auth: { username: "admin", password: "secret" }
      })

      await client.ready()

      const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>
      expect(headers.Authorization).toBe(`Basic ${btoa("admin:secret")}`)
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
      const client = new RqliteClient({ host: "localhost:4001", timeout: 50 })

      const resultPromise = client.ready()
      await vi.advanceTimersByTimeAsync(60)
      const result = await resultPromise

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
        expect(result.error.message).toBe("request timed out")
      }
    })
  })

  describe("nodes()", () => {
    const nodesResponse = {
      node1: {
        id: "node1",
        api_addr: "http://localhost:4001",
        addr: "localhost:4002",
        leader: true,
        reachable: true,
        time: 0.001
      },
      node2: {
        id: "node2",
        api_addr: "http://localhost:4003",
        addr: "localhost:4004",
        leader: false,
        reachable: true,
        time: 0.002
      }
    }

    it("returns typed cluster nodes", async () => {
      mockFetch({ ok: true, status: 200, data: nodesResponse })
      const client = new RqliteClient({ host: "localhost:4001" })

      const result = await client.nodes()

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value).toHaveLength(2)
        const leader = result.value.find((n) => n.leader)
        expect(leader).toBeDefined()
        expect(leader?.id).toBe("node1")
        expect(leader?.apiAddr).toBe("http://localhost:4001")
        expect(leader?.addr).toBe("localhost:4002")
        expect(leader?.reachable).toBe(true)
        expect(leader?.time).toBe(0.001)
      }
    })

    it("maps snake_case fields to camelCase", async () => {
      mockFetch({ ok: true, status: 200, data: nodesResponse })
      const client = new RqliteClient({ host: "localhost:4001" })

      const result = await client.nodes()

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        for (const node of result.value) {
          expect(node).toHaveProperty("apiAddr")
          expect(node).toHaveProperty("addr")
          expect(node).not.toHaveProperty("api_addr")
        }
      }
    })

    it("calls GET /nodes endpoint", async () => {
      const fetchMock = mockFetch({ ok: true, status: 200, data: nodesResponse })
      const client = new RqliteClient({ host: "localhost:4001" })

      await client.nodes()

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4001/nodes",
        expect.objectContaining({ method: "GET" })
      )
    })

    it("passes nonvoters query parameter", async () => {
      const fetchMock = mockFetch({ ok: true, status: 200, data: nodesResponse })
      const client = new RqliteClient({ host: "localhost:4001" })

      await client.nodes({ nonvoters: true })

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4001/nodes?nonvoters=",
        expect.objectContaining({ method: "GET" })
      )
    })

    it("returns AuthenticationError on 401", async () => {
      mockFetch({ ok: false, status: 401 })
      const client = new RqliteClient({ host: "localhost:4001", maxRetries: 0 })

      const result = await client.nodes()

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(AuthenticationError.isError(result.error)).toBe(true)
      }
    })

    it("returns ConnectionError on network error", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")))
      const client = new RqliteClient({ host: "localhost:4001", maxRetries: 0 })

      const result = await client.nodes()

      expect(isErr(result)).toBe(true)
      if (!result.ok) {
        expect(ConnectionError.isError(result.error)).toBe(true)
      }
    })

    it("handles empty nodes response", async () => {
      mockFetch({ ok: true, status: 200, data: {} })
      const client = new RqliteClient({ host: "localhost:4001" })

      const result = await client.nodes()

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value).toHaveLength(0)
      }
    })

    it("handles node without time field", async () => {
      const nodeWithoutTime = {
        node1: {
          id: "node1",
          api_addr: "http://localhost:4001",
          addr: "localhost:4002",
          leader: true,
          reachable: true
        }
      }
      mockFetch({ ok: true, status: 200, data: nodeWithoutTime })
      const client = new RqliteClient({ host: "localhost:4001" })

      const result = await client.nodes()

      expect(isOk(result)).toBe(true)
      if (result.ok) {
        expect(result.value[0].time).toBeUndefined()
      }
    })
  })
})
