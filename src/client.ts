/**
 * HTTP client for rqlite.
 *
 * Provides low-level connection management, authentication, timeout handling,
 * and error mapping. Higher-level operations (execute, query) are built on top.
 */

import { AuthenticationError, ConnectionError, QueryError, type RqliteError } from "./errors.js"
import { err, ok, type Result } from "./result.js"
import type {
  ClusterNode,
  ExecuteOptions,
  ExecuteResult,
  QueryOptions,
  QueryResult,
  ReadyResult,
  RequestOptions as RequestOpts,
  RequestResult,
  RqliteAuth,
  RqliteConfig,
  SqlValue
} from "./types.js"

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

/** Default maximum number of retry attempts for transient failures. */
const DEFAULT_MAX_RETRIES = 3

/** Default maximum number of leader redirect attempts. */
const DEFAULT_MAX_REDIRECTS = 5

/** Default base delay in milliseconds for exponential backoff. */
const DEFAULT_RETRY_BASE_DELAY = 100

/** rqlite HTTP client with connection management and authentication. */
export class RqliteClient {
  private readonly baseUrl: string
  private readonly authHeader: string | undefined
  private readonly defaultTimeout: number
  private readonly config: RqliteConfig
  private readonly followRedirects: boolean
  private readonly maxRetries: number
  private readonly maxRedirects: number
  private readonly retryBaseDelay: number

  constructor(config: RqliteConfig) {
    const scheme = config.tls === true ? "https" : "http"
    this.baseUrl = `${scheme}://${config.host}`
    this.authHeader = config.auth ? encodeBasicAuth(config.auth) : undefined
    this.defaultTimeout = config.timeout ?? 10_000
    this.config = config
    this.followRedirects = config.followRedirects ?? true
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES
    this.maxRedirects = config.maxRedirects ?? DEFAULT_MAX_REDIRECTS
    this.retryBaseDelay = config.retryBaseDelay ?? DEFAULT_RETRY_BASE_DELAY
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

  /**
   * Execute a single SQL query (read).
   *
   * @example
   * ```ts
   * // Simple query
   * const result = await client.query("SELECT * FROM foo")
   *
   * // Parameterised query
   * const result = await client.query("SELECT * FROM foo WHERE id = ?", [1])
   *
   * // With consistency level
   * const result = await client.query("SELECT * FROM foo", undefined, { level: "strong" })
   * ```
   */
  async query(
    sql: string,
    params?: SqlValue[],
    options?: QueryOptions
  ): Promise<Result<QueryResult, RqliteError>> {
    const statement = params !== undefined ? [sql, ...params] : [sql]
    const result = await this.queryBatch([statement], options)
    if (!result.ok) {
      return result
    }
    if (result.value.length === 0) {
      return err(new ConnectionError("empty query response"))
    }
    return ok(result.value[0])
  }

  /**
   * Execute multiple SQL queries in a single request.
   *
   * @example
   * ```ts
   * const results = await client.queryBatch([
   *   ["SELECT * FROM foo WHERE id = ?", 1],
   *   ["SELECT COUNT(*) FROM foo"],
   * ])
   * ```
   */
  async queryBatch(
    statements: unknown[],
    options?: QueryOptions
  ): Promise<Result<QueryResult[], RqliteError>> {
    const queryParams = buildQueryParams(options, this.config)
    const result = await this.post<RqliteQueryResponse>("/db/query", statements, queryParams)
    if (!result.ok) {
      return result
    }
    return parseQueryResponse(result.value)
  }

  /**
   * Execute mixed read/write SQL statements in a single HTTP call.
   *
   * Uses the rqlite `/db/request` endpoint which accepts both SELECT and
   * write statements. Each result is tagged with `type: "query"` or
   * `type: "execute"` based on the statement.
   *
   * @example
   * ```ts
   * const results = await client.requestBatch([
   *   ["INSERT INTO foo VALUES(?, ?)", 1, "bar"],
   *   ["SELECT * FROM foo"],
   * ], { transaction: true })
   *
   * if (results.ok) {
   *   for (const r of results.value) {
   *     if (r.type === "execute") console.log(r.rowsAffected)
   *     if (r.type === "query") console.log(r.columns, r.values)
   *   }
   * }
   * ```
   */
  async requestBatch(
    statements: unknown[],
    options?: RequestOpts
  ): Promise<Result<RequestResult[], RqliteError>> {
    const params = buildRequestParams(options, this.config)
    const result = await this.post<RqliteRequestResponse>("/db/request", statements, params)
    if (!result.ok) {
      return result
    }
    return parseRequestResponse(result.value, statements)
  }

  /**
   * Get the status of the connected rqlite node.
   *
   * Returns the full status object from the `/status` endpoint. The structure
   * varies by rqlite version; fields are not strictly typed.
   *
   * @example
   * ```ts
   * const result = await client.status()
   * if (result.ok) console.log(result.value)
   * ```
   */
  async status(): Promise<Result<Record<string, unknown>, RqliteError>> {
    return this.get<Record<string, unknown>>("/status")
  }

  /**
   * Get the rqlite server version string.
   *
   * Extracts the `build.version` field from the `/status` endpoint.
   * Returns `undefined` if the version field is not present.
   *
   * @example
   * ```ts
   * const result = await client.serverVersion()
   * if (result.ok) console.log(result.value) // "v9.4.5"
   * ```
   */
  async serverVersion(): Promise<Result<string | undefined, RqliteError>> {
    const result = await this.status()
    if (!result.ok) {
      return result
    }
    const { build } = result.value
    if (typeof build === "object" && build !== null && "version" in build) {
      const { version } = build as Record<string, unknown>
      return ok(typeof version === "string" ? version : undefined)
    }
    return ok(undefined)
  }

  /**
   * Check if the connected rqlite node is ready to accept requests.
   *
   * Calls the `/readyz` endpoint which returns HTTP 200 if the node is ready,
   * or HTTP 503 if not. The `noleader` query parameter allows checking readiness
   * without requiring a leader.
   *
   * @example
   * ```ts
   * const result = await client.ready()
   * if (result.ok && result.value.ready) {
   *   console.log("node is ready, leader:", result.value.isLeader)
   * }
   * ```
   */
  async ready(options?: { noleader?: boolean }): Promise<Result<ReadyResult, RqliteError>> {
    const params: Record<string, string> = {}
    if (options?.noleader === true) {
      params.noleader = ""
    }
    return this.requestText("/readyz", params)
  }

  /**
   * List all nodes in the rqlite cluster.
   *
   * Calls the `/nodes` endpoint and returns typed node information including
   * leader status and reachability.
   *
   * @example
   * ```ts
   * const result = await client.nodes()
   * if (result.ok) {
   *   for (const node of result.value) {
   *     console.log(node.id, node.leader ? "(leader)" : "")
   *   }
   * }
   * ```
   */
  async nodes(options?: { nonvoters?: boolean }): Promise<Result<ClusterNode[], RqliteError>> {
    const params: Record<string, string> = {}
    if (options?.nonvoters === true) {
      params.nonvoters = ""
    }
    const result = await this.get<RqliteNodesResponse>("/nodes", params)
    if (!result.ok) {
      return result
    }
    return ok(parseNodesResponse(result.value))
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

  /** Execute an HTTP request against rqlite with redirect following and retry. */
  private async request<T>(options: RequestOptions): Promise<Result<T, ClientError>> {
    const timeout = options.timeout ?? this.defaultTimeout
    let url = this.buildUrl(options.path, options.params)

    const headers: Record<string, string> = {}
    if (this.authHeader !== undefined) {
      headers.Authorization = this.authHeader
    }
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json"
    }

    const bodyStr = options.body !== undefined ? JSON.stringify(options.body) : undefined
    let lastError: ClientError | undefined
    let retries = 0
    let redirects = 0

    while (retries <= this.maxRetries && redirects <= this.maxRedirects) {
      if (retries > 0 && lastError !== undefined) {
        await sleep(jitteredDelay(this.retryBaseDelay, retries - 1))
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        controller.abort()
      }, timeout)

      try {
        const response = await fetch(url, {
          method: options.method,
          headers,
          body: bodyStr,
          signal: controller.signal,
          redirect: "manual"
        })

        // Handle leader redirects (301/307)
        if ((response.status === 301 || response.status === 307) && this.followRedirects) {
          const location = response.headers.get("Location")
          if (location !== null) {
            url = location
            lastError = new ConnectionError("leader redirect", { url })
            redirects++
            continue
          }
        }

        return await handleResponse<T>(response, url)
      } catch (error) {
        lastError = mapFetchError(error, url)
        retries++
      } finally {
        clearTimeout(timeoutId)
      }
    }

    return err(lastError ?? new ConnectionError("max retries exceeded", { url }))
  }

  /**
   * Send a GET request to a text endpoint (e.g. `/readyz`) and parse the ready state.
   *
   * Unlike `request()`, this treats HTTP 503 as a valid "not ready" response
   * rather than an error.
   */
  private async requestText(
    path: string,
    params?: Record<string, string>
  ): Promise<Result<ReadyResult, ClientError>> {
    const timeout = this.defaultTimeout
    const url = this.buildUrl(path, params)

    const headers: Record<string, string> = {}
    if (this.authHeader !== undefined) {
      headers.Authorization = this.authHeader
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, timeout)

    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal
      })

      if (response.status === 401) {
        return err(new AuthenticationError("unauthorised"))
      }

      if (response.status === 403) {
        return err(new AuthenticationError("forbidden"))
      }

      const body = await response.text()
      const ready = response.status === 200
      const isLeader = body.includes("[Leader]")

      return ok({ ready, isLeader })
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

type ClientError = ConnectionError | AuthenticationError | QueryError

/** Encode basic auth credentials as a header value. */
function encodeBasicAuth(auth: RqliteAuth): string {
  const credentials = `${auth.username}:${auth.password}`
  return `Basic ${btoa(credentials)}`
}

/** Sleep for the given number of milliseconds. */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** Calculate a jittered delay for exponential backoff. */
function jitteredDelay(baseDelay: number, attempt: number): number {
  const delay = baseDelay * 2 ** attempt
  return Math.round(delay * (0.5 + Math.random() * 0.5))
}

/** Handle a fetch Response and map to Result. */
async function handleResponse<T>(response: Response, url: string): Promise<Result<T, ClientError>> {
  if (response.status === 401) {
    return err(new AuthenticationError("unauthorised"))
  }

  if (response.status === 403) {
    return err(new AuthenticationError("forbidden"))
  }

  if (!response.ok) {
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
function parseExecuteResponse(raw: RqliteExecuteResponse): Result<ExecuteResult[], ClientError> {
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

// =============================================================================
// Query Response Parsing
// =============================================================================

/** Raw rqlite query endpoint response. */
type RqliteQueryResponse = {
  results?: RqliteQueryResultItem[]
}

/** A single result item from rqlite's query response. */
type RqliteQueryResultItem = {
  columns?: string[]
  types?: string[]
  values?: SqlValue[][]
  time?: number
  error?: string
}

/** Build query parameters for query requests. */
function buildQueryParams(
  options: QueryOptions | undefined,
  config: RqliteConfig
): Record<string, string> | undefined {
  const level = options?.level ?? config.consistencyLevel
  const freshness = options?.freshness ?? config.freshness
  const associative = options?.associative

  const params: Record<string, string> = {}

  if (level !== undefined) {
    params.level = level
  }
  if (freshness !== undefined) {
    params.freshness = freshness.freshness
    if (freshness.freshnessStrict === true) {
      params.freshness_strict = ""
    }
  }
  if (associative === true) {
    params.associative = ""
  }

  return Object.keys(params).length > 0 ? params : undefined
}

/** Parse the raw rqlite query response into typed results. */
function parseQueryResponse(raw: RqliteQueryResponse): Result<QueryResult[], ClientError> {
  if (raw.results === undefined) {
    return err(new ConnectionError("missing results in query response"))
  }

  const results: QueryResult[] = []
  for (const item of raw.results) {
    if (item.error !== undefined) {
      return err(new QueryError(item.error))
    }
    results.push({
      columns: item.columns ?? [],
      types: item.types ?? [],
      values: item.values ?? [],
      time: item.time ?? 0
    })
  }
  return ok(results)
}

// =============================================================================
// Request Response Parsing
// =============================================================================

/** Raw rqlite request endpoint response (mixed execute/query). */
type RqliteRequestResponse = {
  results?: RqliteRequestResultItem[]
}

/** A single result item from rqlite's request response — may be execute or query shaped. */
type RqliteRequestResultItem = {
  last_insert_id?: number
  rows_affected?: number
  columns?: string[]
  types?: string[]
  values?: SqlValue[][]
  time?: number
  error?: string
}

/** Build query parameters for unified request operations. */
function buildRequestParams(
  options: RequestOpts | undefined,
  config: RqliteConfig
): Record<string, string> | undefined {
  const level = options?.level ?? config.consistencyLevel
  const freshness = options?.freshness ?? config.freshness

  const params: Record<string, string> = {}

  if (options?.transaction === true) {
    params.transaction = ""
  }
  if (level !== undefined) {
    params.level = level
  }
  if (freshness !== undefined) {
    params.freshness = freshness.freshness
    if (freshness.freshnessStrict === true) {
      params.freshness_strict = ""
    }
  }

  return Object.keys(params).length > 0 ? params : undefined
}

/**
 * Extract the SQL string from a statement in array format.
 * Statements can be `["SQL"]` or `["SQL", param1, param2, ...]`.
 */
function extractSql(statement: unknown): string | undefined {
  if (Array.isArray(statement) && typeof statement[0] === "string") {
    return statement[0]
  }
  if (typeof statement === "string") {
    return statement
  }
  return undefined
}

/** Check whether a SQL string is a read (SELECT) statement. */
function isSelectStatement(sql: string): boolean {
  return sql.trimStart().toUpperCase().startsWith("SELECT")
}

/** Parse the raw rqlite request response into typed results. */
function parseRequestResponse(
  raw: RqliteRequestResponse,
  statements: unknown[]
): Result<RequestResult[], ClientError> {
  if (raw.results === undefined) {
    return err(new ConnectionError("missing results in request response"))
  }

  const results: RequestResult[] = []
  for (let i = 0; i < raw.results.length; i++) {
    const item = raw.results[i]
    if (item.error !== undefined) {
      return err(new QueryError(item.error))
    }

    const sql = extractSql(statements[i])
    const isQuery = sql !== undefined && isSelectStatement(sql)

    if (isQuery) {
      results.push({
        type: "query",
        columns: item.columns ?? [],
        types: item.types ?? [],
        values: item.values ?? [],
        time: item.time ?? 0
      })
    } else {
      results.push({
        type: "execute",
        lastInsertId: item.last_insert_id ?? 0,
        rowsAffected: item.rows_affected ?? 0,
        time: item.time ?? 0
      })
    }
  }
  return ok(results)
}

// =============================================================================
// Nodes Response Parsing
// =============================================================================

/** Raw node object from rqlite's `/nodes` endpoint. */
type RqliteNodeItem = {
  id: string
  api_addr: string
  addr: string
  leader: boolean
  reachable: boolean
  time?: number
}

/** Raw response from rqlite's `/nodes` endpoint. */
type RqliteNodesResponse = Record<string, RqliteNodeItem>

/** Map raw nodes response to typed ClusterNode array. */
function parseNodesResponse(raw: RqliteNodesResponse): ClusterNode[] {
  return Object.values(raw).map((node) => ({
    id: node.id,
    apiAddr: node.api_addr,
    addr: node.addr,
    leader: node.leader,
    reachable: node.reachable,
    time: node.time
  }))
}
