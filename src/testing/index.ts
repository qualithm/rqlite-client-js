/**
 * Testing utilities for npm-example.
 *
 * This subpath export (`@qualithm/npm-example/testing`) provides utilities
 * for testing code that depends on this package.
 *
 * @example
 * ```ts
 * import { createMockGreeter, testFixtures } from "@qualithm/npm-example/testing"
 *
 * // Use mock greeter
 * const greeter = createMockGreeter()
 * greeter.greet({ name: "Test" })
 * expect(greeter.calls).toHaveLength(1)
 *
 * // Use test fixtures
 * for (const fixture of testFixtures.greetings) {
 *   expect(greet(fixture.input)).toBe(fixture.expected)
 * }
 * ```
 *
 * @packageDocumentation
 */

import { greet, type GreetOptions } from "../greet.js"

// ============================================================================
// Mock Greeter
// ============================================================================

/**
 * A recorded call to the mock greeter.
 */
export type GreeterCall = {
  /** The options passed to greet. */
  options: GreetOptions
  /** The result returned. */
  result: string
}

/**
 * Mock greeter for testing.
 */
export type MockGreeter = {
  /** Greet with recording. */
  greet: (options: GreetOptions) => string
  /** Recorded calls. */
  calls: GreeterCall[]
  /** Clear recorded calls. */
  clear: () => void
}

/**
 * Create a mock greeter that records all calls.
 *
 * @example
 * ```ts
 * const mock = createMockGreeter()
 * mock.greet({ name: "Test" })
 * expect(mock.calls).toHaveLength(1)
 * expect(mock.calls[0].options.name).toBe("Test")
 * ```
 */
export function createMockGreeter(): MockGreeter {
  const calls: GreeterCall[] = []

  return {
    greet(options: GreetOptions): string {
      const result = greet(options)
      calls.push({ options, result })
      return result
    },
    calls,
    clear() {
      calls.length = 0
    }
  }
}

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * A test fixture for greeting.
 */
export type GreetFixture = {
  /** Description of the test case. */
  description: string
  /** Input options. */
  input: GreetOptions
  /** Expected output. */
  expected: string
}

/**
 * Test fixtures for common scenarios.
 */
export const testFixtures = {
  /** Greeting test cases. */
  greetings: [
    {
      description: "simple greeting",
      input: { name: "World" },
      expected: "Hello, World!"
    },
    {
      description: "formal greeting",
      input: { name: "World", formal: true },
      expected: "Good day, World."
    },
    {
      description: "greeting with special characters",
      input: { name: "José" },
      expected: "Hello, José!"
    }
  ] satisfies GreetFixture[]
}
