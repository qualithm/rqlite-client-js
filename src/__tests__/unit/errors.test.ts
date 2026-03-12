import { describe, expect, it } from "vitest"

import { AuthenticationError, ConnectionError, QueryError, RqliteError } from "../../errors"

describe("RqliteError", () => {
  it("creates an error with a message", () => {
    const error = new RqliteError("something failed")
    expect(error.message).toBe("something failed")
    expect(error.name).toBe("RqliteError")
    expect(error.tag).toBe("RqliteError")
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(RqliteError)
  })

  it("supports a cause option", () => {
    const cause = new Error("root cause")
    const error = new RqliteError("wrapper", { cause })
    expect(error.cause).toBe(cause)
  })

  describe("isError", () => {
    it("returns true for RqliteError", () => {
      expect(RqliteError.isError(new RqliteError("x"))).toBe(true)
    })

    it("returns true for subclass instances", () => {
      expect(RqliteError.isError(new ConnectionError("x"))).toBe(true)
      expect(RqliteError.isError(new QueryError("x"))).toBe(true)
      expect(RqliteError.isError(new AuthenticationError("x"))).toBe(true)
    })

    it("returns false for plain Error", () => {
      expect(RqliteError.isError(new Error("x"))).toBe(false)
    })

    it("returns false for non-errors", () => {
      expect(RqliteError.isError("string")).toBe(false)
      expect(RqliteError.isError(null)).toBe(false)
      expect(RqliteError.isError(undefined)).toBe(false)
      expect(RqliteError.isError(42)).toBe(false)
    })
  })
})

describe("ConnectionError", () => {
  it("creates an error with a message and url", () => {
    const error = new ConnectionError("connection refused", {
      url: "http://localhost:4001"
    })
    expect(error.message).toBe("connection refused")
    expect(error.name).toBe("ConnectionError")
    expect(error.tag).toBe("ConnectionError")
    expect(error.url).toBe("http://localhost:4001")
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(RqliteError)
    expect(error).toBeInstanceOf(ConnectionError)
  })

  it("url is undefined when not provided", () => {
    const error = new ConnectionError("timeout")
    expect(error.url).toBeUndefined()
  })

  it("supports a cause option", () => {
    const cause = new TypeError("fetch failed")
    const error = new ConnectionError("connection failed", { cause })
    expect(error.cause).toBe(cause)
  })

  describe("isError", () => {
    it("returns true for ConnectionError", () => {
      expect(ConnectionError.isError(new ConnectionError("x"))).toBe(true)
    })

    it("returns false for other RqliteError subclasses", () => {
      expect(ConnectionError.isError(new QueryError("x"))).toBe(false)
      expect(ConnectionError.isError(new AuthenticationError("x"))).toBe(false)
    })

    it("returns false for base RqliteError", () => {
      expect(ConnectionError.isError(new RqliteError("x"))).toBe(false)
    })
  })
})

describe("QueryError", () => {
  it("creates an error with a message", () => {
    const error = new QueryError('near "SELEC": syntax error')
    expect(error.message).toBe('near "SELEC": syntax error')
    expect(error.name).toBe("QueryError")
    expect(error.tag).toBe("QueryError")
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(RqliteError)
    expect(error).toBeInstanceOf(QueryError)
  })

  describe("isError", () => {
    it("returns true for QueryError", () => {
      expect(QueryError.isError(new QueryError("x"))).toBe(true)
    })

    it("returns false for other RqliteError subclasses", () => {
      expect(QueryError.isError(new ConnectionError("x"))).toBe(false)
      expect(QueryError.isError(new AuthenticationError("x"))).toBe(false)
    })

    it("returns false for base RqliteError", () => {
      expect(QueryError.isError(new RqliteError("x"))).toBe(false)
    })
  })
})

describe("AuthenticationError", () => {
  it("creates an error with a message", () => {
    const error = new AuthenticationError("unauthorised")
    expect(error.message).toBe("unauthorised")
    expect(error.name).toBe("AuthenticationError")
    expect(error.tag).toBe("AuthenticationError")
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(RqliteError)
    expect(error).toBeInstanceOf(AuthenticationError)
  })

  describe("isError", () => {
    it("returns true for AuthenticationError", () => {
      expect(AuthenticationError.isError(new AuthenticationError("x"))).toBe(true)
    })

    it("returns false for other RqliteError subclasses", () => {
      expect(AuthenticationError.isError(new ConnectionError("x"))).toBe(false)
      expect(AuthenticationError.isError(new QueryError("x"))).toBe(false)
    })

    it("returns false for base RqliteError", () => {
      expect(AuthenticationError.isError(new RqliteError("x"))).toBe(false)
    })
  })
})
