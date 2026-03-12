import { describe, expect, it } from "vitest"

import { ConnectionError } from "../../errors"
import { err } from "../../result"
import { createMockClient, testFixtures } from "../../testing"

describe("createMockClient", () => {
  it("returns default execute result and records calls", async () => {
    const mock = createMockClient()
    const result = await mock.client.execute("INSERT INTO users(name) VALUES(?)", ["Alice"])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.lastInsertId).toBe(1)
      expect(result.value.rowsAffected).toBe(1)
    }
    expect(mock.calls).toHaveLength(1)
    expect(mock.calls[0].method).toBe("execute")
    expect(mock.calls[0].sql).toBe("INSERT INTO users(name) VALUES(?)")
    expect(mock.calls[0].params).toEqual(["Alice"])
  })

  it("returns default query result and records calls", async () => {
    const mock = createMockClient()
    const result = await mock.client.query("SELECT * FROM users")

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.columns).toEqual(["id", "name", "email"])
      expect(result.value.values).toHaveLength(2)
    }
    expect(mock.calls).toHaveLength(1)
    expect(mock.calls[0].method).toBe("query")
  })

  it("returns configurable query result", async () => {
    const mock = createMockClient()
    mock.setQueryResult({
      columns: ["count"],
      types: ["integer"],
      values: [[42]],
      time: 0.005
    })

    const result = await mock.client.query("SELECT COUNT(*) FROM users")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.values).toEqual([[42]])
    }
  })

  it("returns configurable execute result", async () => {
    const mock = createMockClient()
    mock.setExecuteResult({ lastInsertId: 99, rowsAffected: 3, time: 0.01 })

    const result = await mock.client.execute("UPDATE users SET active = 1")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.lastInsertId).toBe(99)
      expect(result.value.rowsAffected).toBe(3)
    }
  })

  it("records status, ready, and nodes calls", async () => {
    const mock = createMockClient()
    await mock.client.status()
    await mock.client.ready()
    await mock.client.nodes()

    expect(mock.calls).toHaveLength(3)
    expect(mock.calls[0].method).toBe("status")
    expect(mock.calls[1].method).toBe("ready")
    expect(mock.calls[2].method).toBe("nodes")
  })

  it("returns configurable status result", async () => {
    const mock = createMockClient()
    mock.setStatusResult({ store: { raft: { state: "Leader" } } })

    const result = await mock.client.status()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({ store: { raft: { state: "Leader" } } })
    }
  })

  it("returns configurable ready result", async () => {
    const mock = createMockClient()
    mock.setReadyResult({ ready: false, isLeader: false })

    const result = await mock.client.ready()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.ready).toBe(false)
      expect(result.value.isLeader).toBe(false)
    }
  })

  it("returns configurable nodes result", async () => {
    const mock = createMockClient()
    const nodes = [
      { id: "n1", apiAddr: "http://host1:4001", addr: "host1:4002", leader: true, reachable: true },
      { id: "n2", apiAddr: "http://host2:4001", addr: "host2:4002", leader: false, reachable: true }
    ]
    mock.setNodesResult(nodes)

    const result = await mock.client.nodes()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toHaveLength(2)
      expect(result.value[0].id).toBe("n1")
    }
  })

  it("error override applies to all methods", async () => {
    const mock = createMockClient()
    mock.setError(err(new ConnectionError("down")))

    const executeResult = await mock.client.execute("INSERT INTO x VALUES(1)")
    const statusResult = await mock.client.status()
    const readyResult = await mock.client.ready()
    const nodesResult = await mock.client.nodes()

    expect(executeResult.ok).toBe(false)
    expect(statusResult.ok).toBe(false)
    expect(readyResult.ok).toBe(false)
    expect(nodesResult.ok).toBe(false)
  })

  it("clears recorded calls", async () => {
    const mock = createMockClient()
    await mock.client.query("SELECT 1")
    expect(mock.calls).toHaveLength(1)

    mock.clear()
    expect(mock.calls).toHaveLength(0)
  })

  it("returns error when error override is set", async () => {
    const mock = createMockClient()
    mock.setError(err(new ConnectionError("connection refused")))

    const result = await mock.client.query("SELECT 1")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toBe("connection refused")
    }
  })

  it("clears error override", async () => {
    const mock = createMockClient()
    mock.setError(err(new ConnectionError("connection refused")))
    mock.clearError()

    const result = await mock.client.query("SELECT 1")
    expect(result.ok).toBe(true)
  })
})

describe("testFixtures", () => {
  it("contains valid execute result", () => {
    expect(testFixtures.executeResult.lastInsertId).toBe(1)
    expect(testFixtures.executeResult.rowsAffected).toBe(1)
    expect(testFixtures.executeResult.time).toBeGreaterThan(0)
  })

  it("contains valid query result with rows", () => {
    expect(testFixtures.queryResult.columns).toHaveLength(3)
    expect(testFixtures.queryResult.values).toHaveLength(2)
    expect(testFixtures.queryResult.types).toHaveLength(3)
  })

  it("contains valid empty query result", () => {
    expect(testFixtures.emptyQueryResult.columns).toHaveLength(2)
    expect(testFixtures.emptyQueryResult.values).toHaveLength(0)
  })

  it("contains valid cluster node", () => {
    expect(testFixtures.clusterNode.id).toBe("node-1")
    expect(testFixtures.clusterNode.leader).toBe(true)
    expect(testFixtures.clusterNode.reachable).toBe(true)
  })
})
