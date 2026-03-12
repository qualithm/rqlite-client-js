/**
 * Integration test: verifies the package exports work end-to-end.
 *
 * Run: bun run test:integration
 */

import { describe, expect, it } from "vitest"

import { greet } from "../../index.js"

describe("greet integration", () => {
  it("produces casual greeting", () => {
    expect(greet({ name: "World" })).toBe("Hello, World!")
  })

  it("produces formal greeting", () => {
    expect(greet({ name: "Professor", formal: true })).toBe("Good day, Professor.")
  })

  it("defaults to casual", () => {
    expect(greet({ name: "Test" })).toBe("Hello, Test!")
  })
})
