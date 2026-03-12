/**
 * HTTP response fixture utilities for testing.
 *
 * Loads captured rqlite HTTP responses from JSON fixtures and provides
 * helpers to mock `fetch` with fixture data.
 */

import { vi } from "vitest"

import fixtures from "../fixtures/rqlite-responses.json"

// =============================================================================
// Types
// =============================================================================

type FixtureEntry = {
  status: number
  body: unknown
  headers?: Record<string, string>
}

type FixtureCategory = Record<string, FixtureEntry>

type FixtureStore = {
  execute: FixtureCategory
  query: FixtureCategory
  status: FixtureCategory
  nodes: FixtureCategory
  errors: FixtureCategory
}

// =============================================================================
// Fixture Access
// =============================================================================

/** Type-safe access to rqlite response fixtures. */
export const rqliteFixtures = fixtures as unknown as FixtureStore

/**
 * Get a fixture entry by category and name.
 *
 * @example
 * ```ts
 * const fixture = getFixture("execute", "insertRow")
 * // { status: 200, body: { results: [...] } }
 * ```
 */
export function getFixture(category: keyof FixtureStore, name: string): FixtureEntry {
  const cat = rqliteFixtures[category] as FixtureCategory | undefined
  const entry = cat?.[name]
  if (entry === undefined) {
    throw new Error(`fixture not found: ${category}.${name}`)
  }
  return entry
}

// =============================================================================
// Mock Helpers
// =============================================================================

/**
 * Create a mock fetch function that returns a fixture response.
 *
 * @example
 * ```ts
 * const fetchMock = mockFetchWithFixture("execute", "insertRow")
 * vi.stubGlobal("fetch", fetchMock)
 * ```
 */
export function mockFetchWithFixture(
  category: keyof FixtureStore,
  name: string
): ReturnType<typeof vi.fn> {
  const fixture = getFixture(category, name)
  return mockFetchWithResponse(fixture)
}

/**
 * Create a mock fetch function from a raw fixture entry.
 */
export function mockFetchWithResponse(fixture: FixtureEntry): ReturnType<typeof vi.fn> {
  const headers = new Headers(fixture.headers ?? {})
  const bodyText =
    typeof fixture.body === "object" && fixture.body !== null
      ? JSON.stringify(fixture.body)
      : typeof fixture.body === "string"
        ? fixture.body
        : ""

  const fetchMock = vi.fn().mockResolvedValue({
    ok: fixture.status >= 200 && fixture.status < 300,
    status: fixture.status,
    headers,
    json: vi.fn().mockResolvedValue(fixture.body),
    text: vi.fn().mockResolvedValue(bodyText)
  })

  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

/**
 * Create a mock fetch that returns different fixtures for sequential calls.
 *
 * @example
 * ```ts
 * const fetchMock = mockFetchSequence([
 *   getFixture("errors", "leaderRedirect"),
 *   getFixture("execute", "insertRow"),
 * ])
 * ```
 */
export function mockFetchSequence(fixtures: FixtureEntry[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn()

  for (const fixture of fixtures) {
    const headers = new Headers(fixture.headers ?? {})
    const bodyText =
      typeof fixture.body === "object" && fixture.body !== null
        ? JSON.stringify(fixture.body)
        : typeof fixture.body === "string"
          ? fixture.body
          : ""

    fetchMock.mockResolvedValueOnce({
      ok: fixture.status >= 200 && fixture.status < 300,
      status: fixture.status,
      headers,
      json: vi.fn().mockResolvedValue(fixture.body),
      text: vi.fn().mockResolvedValue(bodyText)
    })
  }

  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}
