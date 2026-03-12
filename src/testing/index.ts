/**
 * Testing utilities for @qualithm/rqlite-client.
 *
 * This subpath export (`@qualithm/rqlite-client/testing`) provides utilities
 * for testing code that depends on this package.
 *
 * @example
 * ```ts
 * import { createMockClient, testFixtures } from "@qualithm/rqlite-client/testing"
 *
 * // Use mock client
 * const mock = createMockClient()
 * mock.setQueryResult({ columns: ["id", "name"], types: ["integer", "text"], values: [[1, "Alice"]], time: 0.001 })
 * const result = await mock.client.query("SELECT * FROM users")
 * expect(result.ok).toBe(true)
 *
 * // Use test fixtures
 * expect(testFixtures.executeResult.lastInsertId).toBe(1)
 * ```
 *
 * @packageDocumentation
 */

import type { RqliteError } from "../errors.js"
import { ok, type Result } from "../result.js"
import type { ClusterNode, ExecuteResult, QueryResult, ReadyResult, SqlValue } from "../types.js"

// ============================================================================
// Mock Client
// ============================================================================

/**
 * A recorded call to the mock client.
 */
export type MockClientCall = {
  /** The method that was called. */
  method: string
  /** The SQL statement, if applicable. */
  sql?: string
  /** The parameters passed, if applicable. */
  params?: SqlValue[]
}

/**
 * A mock rqlite client for testing.
 *
 * Provides a controllable stand-in for `RqliteClient` that records calls
 * and returns configurable results without making HTTP requests.
 */
export type MockRqliteClient = {
  /** The mock client instance with the same method signatures as `RqliteClient`. */
  client: {
    execute: (sql: string, params?: SqlValue[]) => Promise<Result<ExecuteResult, RqliteError>>
    query: (sql: string, params?: SqlValue[]) => Promise<Result<QueryResult, RqliteError>>
    status: () => Promise<Result<Record<string, unknown>, RqliteError>>
    ready: () => Promise<Result<ReadyResult, RqliteError>>
    nodes: () => Promise<Result<ClusterNode[], RqliteError>>
  }
  /** Recorded calls to the mock client. */
  calls: MockClientCall[]
  /** Clear recorded calls. */
  clear: () => void
  /** Set the result returned by `execute()`. */
  setExecuteResult: (result: ExecuteResult) => void
  /** Set the result returned by `query()`. */
  setQueryResult: (result: QueryResult) => void
  /** Set the result returned by `status()`. */
  setStatusResult: (result: Record<string, unknown>) => void
  /** Set the result returned by `ready()`. */
  setReadyResult: (result: ReadyResult) => void
  /** Set the result returned by `nodes()`. */
  setNodesResult: (result: ClusterNode[]) => void
  /** Set an error result to be returned by all methods. */
  setError: (error: Result<never, RqliteError>) => void
  /** Clear any error override so methods return their configured results. */
  clearError: () => void
}

/**
 * Create a mock rqlite client that records calls and returns configurable results.
 *
 * @example
 * ```ts
 * const mock = createMockClient()
 * mock.setQueryResult({
 *   columns: ["id", "name"],
 *   types: ["integer", "text"],
 *   values: [[1, "Alice"]],
 *   time: 0.001,
 * })
 * const result = await mock.client.query("SELECT * FROM users")
 * expect(result.ok).toBe(true)
 * expect(mock.calls).toHaveLength(1)
 * ```
 */
export function createMockClient(): MockRqliteClient {
  const calls: MockClientCall[] = []

  let executeResult: Result<ExecuteResult, RqliteError> = ok(testFixtures.executeResult)
  let queryResult: Result<QueryResult, RqliteError> = ok(testFixtures.queryResult)
  let statusResult: Result<Record<string, unknown>, RqliteError> = ok({ store: {} })
  let readyResult: Result<ReadyResult, RqliteError> = ok({ ready: true, isLeader: true })
  let nodesResult: Result<ClusterNode[], RqliteError> = ok([testFixtures.clusterNode])
  let errorOverride: Result<never, RqliteError> | undefined

  return {
    client: {
      // eslint-disable-next-line @typescript-eslint/require-await
      async execute(sql: string, params?: SqlValue[]) {
        calls.push({ method: "execute", sql, params })
        return errorOverride ?? executeResult
      },
      // eslint-disable-next-line @typescript-eslint/require-await
      async query(sql: string, params?: SqlValue[]) {
        calls.push({ method: "query", sql, params })
        return errorOverride ?? queryResult
      },
      // eslint-disable-next-line @typescript-eslint/require-await
      async status() {
        calls.push({ method: "status" })
        return errorOverride ?? statusResult
      },
      // eslint-disable-next-line @typescript-eslint/require-await
      async ready() {
        calls.push({ method: "ready" })
        return errorOverride ?? readyResult
      },
      // eslint-disable-next-line @typescript-eslint/require-await
      async nodes() {
        calls.push({ method: "nodes" })
        return errorOverride ?? nodesResult
      }
    },
    calls,
    clear() {
      calls.length = 0
    },
    setExecuteResult(result: ExecuteResult) {
      executeResult = ok(result)
    },
    setQueryResult(result: QueryResult) {
      queryResult = ok(result)
    },
    setStatusResult(result: Record<string, unknown>) {
      statusResult = ok(result)
    },
    setReadyResult(result: ReadyResult) {
      readyResult = ok(result)
    },
    setNodesResult(result: ClusterNode[]) {
      nodesResult = ok(result)
    },
    setError(error: Result<never, RqliteError>) {
      errorOverride = error
    },
    clearError() {
      errorOverride = undefined
    }
  }
}

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Common test fixtures for rqlite responses.
 */
export const testFixtures = {
  /** A typical execute result for a single INSERT. */
  executeResult: {
    lastInsertId: 1,
    rowsAffected: 1,
    time: 0.001
  } satisfies ExecuteResult,

  /** A typical query result with columns and rows. */
  queryResult: {
    columns: ["id", "name", "email"],
    types: ["integer", "text", "text"],
    values: [
      [1, "Alice", "alice@example.com"],
      [2, "Bob", "bob@example.com"]
    ],
    time: 0.002
  } satisfies QueryResult,

  /** An empty query result (no rows matched). */
  emptyQueryResult: {
    columns: ["id", "name"],
    types: ["integer", "text"],
    values: [],
    time: 0.001
  } satisfies QueryResult,

  /** A typical cluster node entry. */
  clusterNode: {
    id: "node-1",
    apiAddr: "http://localhost:4001",
    addr: "localhost:4002",
    leader: true,
    reachable: true
  } satisfies ClusterNode
}
