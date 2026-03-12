/**
 * HTTP client for rqlite.
 *
 * Provides low-level connection management, authentication, timeout handling,
 * and error mapping. Higher-level operations (execute, query) are built on top.
 */

import { AuthenticationError, ConnectionError, QueryError } from "./errors.js"
import { err, ok, type Result } from "./result.js"
import type { ExecuteOptions, ExecuteResult, RqliteAuth, RqliteConfig, SqlValue } from "./types.js"

// =============================================================================
// Internal Types
// =============================================================================

/** HTTP methods used by the rqlite API. */
type HttpMethod = "GET" | "POST"

/** Options for a single HTTP request to rqlite. */
type RequestOptions = {
  method: HttpMethod
  path: string
  body?: unknown
  params?: Record<string, string>
  timeout?: number
}

// =============================================================================
// RqliteClient
// =============================================================================

/** rqlite HTTP client with connection management and authentication. */
export class RqliteClient {
  private readonly baseUrl: string
  private readonly authHeader: string | undefined
  private readonly defaultTimeout: number

  constructor(config: RqliteConfig) {
    const scheme = config.tls === true ? "https" : "http"
    this.baseUrl = `${scheme}://${config.host}`
    this.authHeader = config.auth ? encodeBasicAuth(config.auth) : undefined
    this.defaultTimeout = config.timeout ?? 10_000
  }

  /** Send a GET request and parse the JSON response. */
  async get<T>(path: string, params?: Record<string, string>): Promise<Result<T, RqliteError>> {
    return this.request<T>({ method: "GET", path, params })
  }

  /** Send a POST request with a JSON body and parse the response. */
  async post<T>(
    path: string,
    body: unknown,
    params?: Record<string, string>
  ): Promise<Result<T, RqliteError>> {
    return this.request<T>({ method: "POST", path, body, params })
  }

  /**
   * Execute a single SQL write statement.
   *
   * @example
   * ```ts
   * // Simple statement
   * const result = await client.execute("CREATE TABLE foo (id INTEGER PRIMARY KEY, name TEXT)")
   *
   * // Parameterised statement
   * const result = await client.execute("INSERT INTO foo VALUES(?, ?)", [1, "bar"])
   * ```
   */
  async execute(
    sql: string,
    params?: SqlValue[],
    options?: ExecuteOptions
  ): Promise<Result<ExecuteResult, RqliteError>> {
    const statement = params !== undefined ? [sql, ...params] : [sql]
    const result = await this.executeBatch([statement], options)
    if (!result.ok) {
      return result
    }
    if (result.value.length === 0) {
      return err(new ConnectionError("empty execute response"))
    }
    return ok(result.value[0])
  }

  /**
   * Execute multiple SQL write statements in a single request.
   *
   * @example
   * ```ts
   * const results = await client.executeBatch([
   *   ["INSERT INTO foo VALUES(?, ?)", 1, "bar"],
   *   ["INSERT INTO foo VALUES(?, ?)", 2, "baz"],
   * ], { transaction: true })
   * ```
   */
  async executeBatch(
    statements: unknown[],
    options?: ExecuteOptions
  ): Promise<Result<ExecuteResult[], RqliteError>> {
    const params = buildExecuteParams(options)
    const result = await this.post<RqliteExecuteResponse>("/db/execute", statements, params)
    if (!result.ok) {
      return result
    }
    return parseExecuteResponse(result.value)
  }

  /** Build the full URL for a request. */
  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(path, this.baseUrl)
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value)
      }
    }
    return url.toString()
  }

  /** Execute an HTTP request against rqlite. */
  private async request<T>(options: RequestOptions): Promise<Result<T, RqliteError>> {
    const timeout = options.timeout ?? this.defaultTimeout
    const url = this.buildUrl(options.path, options.params)

    const headers: Record<string, string> = {}
    if (this.authHeader !== undefined) {
      headers.Authorization = this.authHeader
    }
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json"
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, timeout)

    try {
      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
        redirect: "manual"
      })

      return await handleResponse<T>(response, url)
    } catch (error) {
      return err(mapFetchError(error, url))
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

/** Create a new rqlite client. */
export function createRqliteClient(config: RqliteConfig): RqliteClient {
  return new RqliteClient(config)
}

// =============================================================================
// Internal Helpers
// =============================================================================

type RqliteError = ConnectionError | AuthenticationError | QueryError

/** Encode basic auth credentials as a header value. */
function encodeBasicAuth(auth: RqliteAuth): string {
  const credentials = `${auth.username}:${auth.password}`
  return `Basic ${btoa(credentials)}`
}

/** Handle a fetch Response and map to Result. */
async function handleResponse<T>(response: Response, url: string): Promise<Result<T, RqliteError>> {
  if (response.status === 401) {
    return err(new AuthenticationError("unauthorised"))
  }

  if (response.status === 403) {
    return err(new AuthenticationError("forbidden"))
  }

  if (!response.ok && response.status !== 301 && response.status !== 307) {
    const text = await response.text().catch(() => "")
    return err(
      new ConnectionError(
        `rqlite returned HTTP ${String(response.status)}${text ? `: ${text}` : ""}`,
        { url }
      )
    )
  }

  try {
    const data = (await response.json()) as T
    return ok(data)
  } catch {
    return err(new ConnectionError("failed to parse response as JSON", { url }))
  }
}

/** Map a fetch error (network, timeout, etc.) to a ConnectionError. */
function mapFetchError(error: unknown, url: string): ConnectionError {
  if (error instanceof DOMException && error.name === "AbortError") {
    return new ConnectionError("request timed out", {
      url,
      cause: error
    })
  }

  if (error instanceof TypeError) {
    return new ConnectionError("network error", {
      url,
      cause: error
    })
  }

  return new ConnectionError("unexpected fetch error", {
    url,
    cause: error instanceof Error ? error : undefined
  })
}

// =============================================================================
// Execute Response Parsing
// =============================================================================

/** Raw rqlite execute endpoint response. */
type RqliteExecuteResponse = {
  results?: RqliteExecuteResultItem[]
}

/** A single result item from rqlite's execute response. */
type RqliteExecuteResultItem = {
  last_insert_id?: number
  rows_affected?: number
  time?: number
  error?: string
}

/** Build query parameters for execute requests. */
function buildExecuteParams(options?: ExecuteOptions): Record<string, string> | undefined {
  if (options === undefined) {
    return undefined
  }

  const params: Record<string, string> = {}
  if (options.transaction === true) {
    params.transaction = ""
  }
  if (options.queue === true) {
    params.queue = ""
  }
  if (options.wait === true) {
    params.wait = ""
  }
  return Object.keys(params).length > 0 ? params : undefined
}

/** Parse the raw rqlite execute response into typed results. */
function parseExecuteResponse(raw: RqliteExecuteResponse): Result<ExecuteResult[], RqliteError> {
  if (raw.results === undefined) {
    return err(new ConnectionError("missing results in execute response"))
  }

  const results: ExecuteResult[] = []
  for (const item of raw.results) {
    if (item.error !== undefined) {
      return err(new QueryError(item.error))
    }
    results.push({
      lastInsertId: item.last_insert_id ?? 0,
      rowsAffected: item.rows_affected ?? 0,
      time: item.time ?? 0
    })
  }
  return ok(results)
}
