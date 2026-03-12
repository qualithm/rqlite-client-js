import { describe, expect, it } from "vitest"

import type {
  ConsistencyLevel,
  ExecuteResult,
  FreshnessOptions,
  QueryResult,
  RqliteAuth,
  RqliteConfig,
  SqlStatement,
  SqlValue
} from "../../types"

describe("types", () => {
  describe("ConsistencyLevel", () => {
    it("accepts valid consistency levels", () => {
      const levels: ConsistencyLevel[] = ["none", "weak", "strong"]
      expect(levels).toHaveLength(3)
    })
  })

  describe("FreshnessOptions", () => {
    it("accepts a freshness duration", () => {
      const opts: FreshnessOptions = { freshness: "5s" }
      expect(opts.freshness).toBe("5s")
      expect(opts.freshnessStrict).toBeUndefined()
    })

    it("accepts freshness with strict flag", () => {
      const opts: FreshnessOptions = { freshness: "1m", freshnessStrict: true }
      expect(opts.freshnessStrict).toBe(true)
    })
  })

  describe("RqliteAuth", () => {
    it("holds username and password", () => {
      const auth: RqliteAuth = { username: "admin", password: "secret" }
      expect(auth.username).toBe("admin")
      expect(auth.password).toBe("secret")
    })
  })

  describe("RqliteConfig", () => {
    it("requires only host", () => {
      const config: RqliteConfig = { host: "localhost:4001" }
      expect(config.host).toBe("localhost:4001")
      expect(config.tls).toBeUndefined()
      expect(config.auth).toBeUndefined()
      expect(config.timeout).toBeUndefined()
      expect(config.consistencyLevel).toBeUndefined()
      expect(config.freshness).toBeUndefined()
    })

    it("accepts all optional fields", () => {
      const config: RqliteConfig = {
        host: "rqlite.example.com:4001",
        tls: true,
        auth: { username: "user", password: "pass" },
        timeout: 5000,
        consistencyLevel: "strong",
        freshness: { freshness: "10s" }
      }
      expect(config.tls).toBe(true)
      expect(config.timeout).toBe(5000)
    })
  })

  describe("SqlValue", () => {
    it("accepts string, number, boolean, null, and Uint8Array", () => {
      const values: SqlValue[] = ["text", 42, true, null, new Uint8Array([1, 2, 3])]
      expect(values).toHaveLength(5)
    })
  })

  describe("SqlStatement", () => {
    it("accepts sql without params", () => {
      const stmt: SqlStatement = { sql: "SELECT 1" }
      expect(stmt.sql).toBe("SELECT 1")
      expect(stmt.params).toBeUndefined()
    })

    it("accepts sql with params", () => {
      const stmt: SqlStatement = {
        sql: "SELECT * FROM foo WHERE id = ?",
        params: [42]
      }
      expect(stmt.params).toEqual([42])
    })
  })

  describe("QueryResult", () => {
    it("holds query result data", () => {
      const result: QueryResult = {
        columns: ["id", "name"],
        types: ["integer", "text"],
        values: [
          [1, "alice"],
          [2, "bob"]
        ],
        time: 0.001
      }
      expect(result.columns).toEqual(["id", "name"])
      expect(result.values).toHaveLength(2)
      expect(result.time).toBe(0.001)
    })
  })

  describe("ExecuteResult", () => {
    it("holds execute result data", () => {
      const result: ExecuteResult = {
        lastInsertId: 5,
        rowsAffected: 1,
        time: 0.002
      }
      expect(result.lastInsertId).toBe(5)
      expect(result.rowsAffected).toBe(1)
      expect(result.time).toBe(0.002)
    })
  })
})
