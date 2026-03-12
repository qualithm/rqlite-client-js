import { describe, expect, it } from "vitest"

import { type Err, err, isErr, isOk, type Ok, ok, type Result, toRows } from "../../result"

describe("Result", () => {
  describe("ok", () => {
    it("creates a successful result", () => {
      const result = ok(42)
      expect(result).toEqual({ ok: true, value: 42 })
    })

    it("creates a successful result with a string value", () => {
      const result = ok("hello")
      expect(result).toEqual({ ok: true, value: "hello" })
    })

    it("creates a successful result with null", () => {
      const result = ok(null)
      expect(result).toEqual({ ok: true, value: null })
    })

    it("creates a successful result with undefined", () => {
      const result = ok(undefined)
      expect(result).toEqual({ ok: true, value: undefined })
    })
  })

  describe("err", () => {
    it("creates a failed result", () => {
      const error = new Error("something went wrong")
      const result = err(error)
      expect(result).toEqual({ ok: false, error })
    })

    it("creates a failed result with a string error", () => {
      const result = err("failed")
      expect(result).toEqual({ ok: false, error: "failed" })
    })
  })

  describe("isOk", () => {
    it("returns true for ok results", () => {
      const result: Result<number, string> = ok(42)
      expect(isOk(result)).toBe(true)
    })

    it("returns false for err results", () => {
      const result: Result<number, string> = err("fail")
      expect(isOk(result)).toBe(false)
    })

    it("narrows the type to Ok", () => {
      const result: Result<number, string> = ok(42)
      if (isOk(result)) {
        expect(result.value).toBe(42)
      }
    })
  })

  describe("isErr", () => {
    it("returns true for err results", () => {
      const result: Result<number, string> = err("fail")
      expect(isErr(result)).toBe(true)
    })

    it("returns false for ok results", () => {
      const result: Result<number, string> = ok(42)
      expect(isErr(result)).toBe(false)
    })

    it("narrows the type to Err", () => {
      const result: Result<number, string> = err("fail")
      if (isErr(result)) {
        expect(result.error).toBe("fail")
      }
    })
  })

  describe("discriminated union", () => {
    it("narrows via .ok property", () => {
      const result = ok(10) as Result<number, string>
      if (result.ok) {
        const okResult: Ok<number> = result
        expect(okResult.value).toBe(10)
      } else {
        const errResult: Err<string> = result
        expect(errResult).toBeDefined()
      }
    })
  })

  describe("toRows", () => {
    it("converts array format to row objects", () => {
      const result = {
        columns: ["id", "name", "email"],
        values: [
          [1, "Alice", "alice@example.com"],
          [2, "Bob", "bob@example.com"]
        ]
      }

      const rows = toRows(result)

      expect(rows).toEqual([
        { id: 1, name: "Alice", email: "alice@example.com" },
        { id: 2, name: "Bob", email: "bob@example.com" }
      ])
    })

    it("returns empty array when values is empty", () => {
      const result = {
        columns: ["id", "name"],
        values: []
      }

      const rows = toRows(result)

      expect(rows).toEqual([])
    })

    it("handles null values", () => {
      const result = {
        columns: ["id", "name"],
        values: [[1, null]]
      }

      const rows = toRows(result)

      expect(rows).toEqual([{ id: 1, name: null }])
    })

    it("handles single column", () => {
      const result = {
        columns: ["count"],
        values: [[42]]
      }

      const rows = toRows(result)

      expect(rows).toEqual([{ count: 42 }])
    })

    it("handles mixed types", () => {
      const result = {
        columns: ["id", "name", "active", "data"],
        values: [[1, "Alice", true, null]]
      }

      const rows = toRows(result)

      expect(rows).toEqual([{ id: 1, name: "Alice", active: true, data: null }])
    })
  })
})
