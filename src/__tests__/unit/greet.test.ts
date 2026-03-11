import { describe, expect, it } from "vitest"

import { greet } from "../../greet"

describe("greet", () => {
  it("returns informal greeting by default", () => {
    const result = greet({ name: "World" })
    expect(result).toBe("Hello, World!")
  })

  it("returns formal greeting when formal is true", () => {
    const result = greet({ name: "World", formal: true })
    expect(result).toBe("Good day, World.")
  })

  it("returns informal greeting when formal is false", () => {
    const result = greet({ name: "Test", formal: false })
    expect(result).toBe("Hello, Test!")
  })

  it("handles names with spaces", () => {
    const result = greet({ name: "John Doe" })
    expect(result).toBe("Hello, John Doe!")
  })

  it("handles empty name", () => {
    const result = greet({ name: "" })
    expect(result).toBe("Hello, !")
  })
})
