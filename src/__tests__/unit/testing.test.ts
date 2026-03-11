import { describe, expect, it } from "vitest"

import { createMockGreeter, testFixtures } from "../../testing"

describe("createMockGreeter", () => {
  it("greets and records calls", () => {
    const mock = createMockGreeter()
    const result = mock.greet({ name: "World" })

    expect(result).toBe("Hello, World!")
    expect(mock.calls).toHaveLength(1)
    expect(mock.calls[0].options).toEqual({ name: "World" })
    expect(mock.calls[0].result).toBe("Hello, World!")
  })

  it("records multiple calls", () => {
    const mock = createMockGreeter()
    mock.greet({ name: "Alice" })
    mock.greet({ name: "Bob", formal: true })

    expect(mock.calls).toHaveLength(2)
    expect(mock.calls[0].result).toBe("Hello, Alice!")
    expect(mock.calls[1].result).toBe("Good day, Bob.")
  })

  it("clears recorded calls", () => {
    const mock = createMockGreeter()
    mock.greet({ name: "Test" })
    expect(mock.calls).toHaveLength(1)

    mock.clear()
    expect(mock.calls).toHaveLength(0)
  })
})

describe("testFixtures", () => {
  it("contains greeting fixtures with correct expected values", () => {
    for (const fixture of testFixtures.greetings) {
      expect(fixture).toHaveProperty("description")
      expect(fixture).toHaveProperty("input")
      expect(fixture).toHaveProperty("expected")
    }
  })

  it("fixtures produce correct greetings via mock greeter", () => {
    const mock = createMockGreeter()

    for (const fixture of testFixtures.greetings) {
      const result = mock.greet(fixture.input)
      expect(result).toBe(fixture.expected)
    }
  })
})
