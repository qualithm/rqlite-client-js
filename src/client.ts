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
  PageResult,
  PaginationOptions,
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
  signal?: AbortSignal
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
  private readonly allowedSchemes: Set<string>
  private readonly authHeader: string | undefined
  private readonly defaultTimeout: number
  private readonly config: RqliteConfig
  private readonly followRedirects: boolean
  private readonly maxRetries: number
  private readonly maxRedirects: number
  private readonly retryBaseDelay: number
  private readonly fetchFn: typeof fetch
  private readonly clientController: AbortController
  private readonly clusterDiscovery: boolean
  /** Ordered list of known peer base URLs. The primary host is always first. */
  private peers: string[]
  private _destroyed = false
  private _peersDiscovered = false

  constructor(config: RqliteConfig) {
    const scheme = config.tls === true ? "https" : "http"
    this.baseUrl = `${scheme}://${config.host}`
    this.allowedSchemes = config.tls === true ? new Set(["https:"]) : new Set(["http:", "https:"])
    this.authHeader = config.auth ? encodeBasicAuth(config.auth) : undefined
    this.defaultTimeout = config.timeout ?? 10_000
    this.config = config
    this.followRedirects = config.followRedirects ?? true
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES
    this.maxRedirects = config.maxRedirects ?? DEFAULT_MAX_REDIRECTS
    this.retryBaseDelay = config.retryBaseDelay ?? DEFAULT_RETRY_BASE_DELAY
    this.fetchFn = config.fetch ?? globalThis.fetch
    this.clientController = new AbortController()
    this.clusterDiscovery = config.clusterDiscovery ?? true
    this.peers = buildPeerList(scheme, config.host, config.hosts)
  }

  /** Whether this client has been destroyed. */
  get destroyed(): boolean {
    return this._destroyed
  }

  /**
   * Destroy the client, aborting all in-flight and future requests.
   *
   * After calling `destroy()`, all pending requests will reject and any
   * new requests will fail immediately.
   */
  destroy(): void {
    this._destroyed = true
    this.clientController.abort()
  }

  /** Send a GET request and parse the JSON response. */
  async get<T>(
    path: string,
    params?: Record<string, string>,
    signal?: AbortSignal
  ): Promise<Result<T, RqliteError>> {
    return this.request<T>({ method: "GET", path, params, signal })
  }

  /** Send a POST request with a JSON body and parse the response. */
  async post<T>(
    path: string,
    body: unknown,
    params?: Record<string, string>,
    signal?: AbortSignal
  ): Promise<Result<T, RqliteError>> {
    return this.request<T>({ method: "POST", path, body, params, signal })
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
    const result = await this.post<RqliteExecuteResponse>(
      "/db/execute",
      statements,
      params,
      options?.signal
    )
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
    const result = await this.post<RqliteQueryResponse>(
      "/db/query",
      statements,
      queryParams,
      options?.signal
    )
    if (!result.ok) {
      return result
    }
    return parseQueryResponse(result.value)
  }

  /**
   * Execute a paginated query, yielding one page at a time.
   *
   * Appends `LIMIT` and `OFFSET` clauses to the user SQL. Each page fetches
   * `pageSize + 1` rows; if the extra row is present, `hasMore` is `true`
   * and only `pageSize` rows are returned.
   *
   * @example
   * ```ts
   * for await (const page of client.queryPaginated(
   *   "SELECT * FROM large_table",
   *   [],
   *   { pageSize: 100 }
   * )) {
   *   console.log(page.rows.values.length, page.hasMore)
   * }
   * ```
   */
  async *queryPaginated(
    sql: string,
    params?: SqlValue[],
    options?: PaginationOptions & QueryOptions
  ): AsyncGenerator<PageResult<QueryResult>, void, undefined> {
    const pageSize = options?.pageSize ?? 100
    let offset = options?.offset ?? 0

    let hasMore = true

    while (hasMore) {
      const paginatedSql = `${sql} LIMIT ? OFFSET ?`
      const paginatedParams: SqlValue[] = [...(params ?? []), pageSize + 1, offset]

      const queryOptions: QueryOptions = {}
      if (options?.level !== undefined) {
        queryOptions.level = options.level
      }
      if (options?.freshness !== undefined) {
        queryOptions.freshness = options.freshness
      }
      if (options?.associative !== undefined) {
        queryOptions.associative = options.associative
      }
      if (options?.timeout !== undefined) {
        queryOptions.timeout = options.timeout
      }
      if (options?.signal !== undefined) {
        queryOptions.signal = options.signal
      }

      const result = await this.query(paginatedSql, paginatedParams, queryOptions)
      if (!result.ok) {
        // Yield a page with empty values so the consumer can inspect the error
        // via the standard Result pattern — but actually we need to throw/return
        // since generators can't yield Result errors. We throw the error so
        // the consumer can catch it.
        throw result.error
      }

      const allValues = result.value.values
      const pageHasMore = allValues.length > pageSize
      const pageValues = pageHasMore ? allValues.slice(0, pageSize) : allValues

      yield {
        rows: {
          columns: result.value.columns,
          types: result.value.types,
          values: pageValues,
          time: result.value.time
        },
        offset,
        hasMore: pageHasMore,
        pageSize
      }

      hasMore = pageHasMore

      offset += pageSize
    }
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
    const result = await this.post<RqliteRequestResponse>(
      "/db/request",
      statements,
      params,
      options?.signal
    )
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
  async ready(options?: {
    noleader?: boolean
    signal?: AbortSignal
  }): Promise<Result<ReadyResult, RqliteError>> {
    const params: Record<string, string> = {}
    if (options?.noleader === true) {
      params.noleader = ""
    }
    return this.requestText("/readyz", params, options?.signal)
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
  async nodes(options?: {
    nonvoters?: boolean
    signal?: AbortSignal
  }): Promise<Result<ClusterNode[], RqliteError>> {
    const params: Record<string, string> = {}
    if (options?.nonvoters === true) {
      params.nonvoters = ""
    }
    const result = await this.get<RqliteNodesResponse>("/nodes", params, options?.signal)
    if (!result.ok) {
      return result
    }
    return ok(parseNodesResponse(result.value))
  }

  /**
   * Refresh the peer list from the `/nodes` endpoint in the background.
   * Failures are silently ignored — discovery is best-effort.
   */
  private refreshPeers(baseUrl: string): void {
    const url = buildUrl(baseUrl, "/nodes")
    const headers: Record<string, string> = {}
    if (this.authHeader !== undefined) {
      headers.Authorization = this.authHeader
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, this.defaultTimeout)

    const cleanup = linkSignals(controller, this.clientController.signal)

    this.fetchFn(url, {
      method: "GET",
      headers,
      signal: controller.signal,
      redirect: "manual"
    })
      .then(async (response) => {
        if (!response.ok) {
          return
        }
        const scheme = this.config.tls === true ? "https" : "http"
        try {
          const data = (await response.json()) as RqliteNodesResponse
          const nodes = parseNodesResponse(data)
          const discovered = nodes
            .filter((n) => n.reachable && n.apiAddr.length > 0)
            .map((n) => normaliseBaseUrl(n.apiAddr, scheme))
          if (discovered.length > 0) {
            // Always keep the primary host first so it's preferred.
            const primary = this.baseUrl
            const rest = discovered.filter((u) => u !== primary)
            this.peers = [primary, ...rest]
          }
        } catch {
          // Ignore parse errors — stale peer list is fine.
        }
      })
      .catch(() => {
        // Network error during discovery — silently ignore.
      })
      .finally(() => {
        clearTimeout(timeoutId)
        cleanup()
      })
  }

  /**
   * Check for a redirect response and validate the Location header.
   * Returns `ok(url)` for a valid redirect, `err(...)` for a disallowed one,
   * or `undefined` if not a redirect.
   */
  private maybeRedirect(response: Response): Result<string, ClientError> | undefined {
    if (!this.followRedirects) {
      return undefined
    }
    if (response.status !== 301 && response.status !== 307) {
      return undefined
    }
    const location = response.headers.get("Location")
    if (location === null) {
      return undefined
    }
    const validated = validateRedirectUrl(location, this.allowedSchemes)
    if (validated === undefined) {
      return err(new ConnectionError("redirect to disallowed URL", { url: location }))
    }
    return ok(validated)
  }

  /** Execute an HTTP request against rqlite with redirect following, peer rotation, and retry. */
  private async request<T>(options: RequestOptions): Promise<Result<T, ClientError>> {
    if (this._destroyed) {
      return err(new ConnectionError("client is destroyed"))
    }

    const timeout = options.timeout ?? this.defaultTimeout

    const headers: Record<string, string> = {}
    if (this.authHeader !== undefined) {
      headers.Authorization = this.authHeader
    }
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json"
    }

    const bodyStr = options.body !== undefined ? JSON.stringify(options.body) : undefined
    let lastError: ClientError | undefined
    let redirects = 0

    // Track which peer we are on and how many attempts we've made across all peers.
    // Strategy: try each peer in order, up to maxRetries network failures total,
    // advancing to the next peer after each failure.
    const { peers } = this
    let peerIndex = 0
    let attemptCount = 0

    // A redirect target may point outside the peer list — track it separately.
    let redirectUrl: string | undefined

    while (attemptCount <= this.maxRetries && redirects <= this.maxRedirects) {
      const baseUrl = redirectUrl ?? peers[peerIndex % peers.length]
      const url = buildUrl(baseUrl, options.path, options.params)

      if (attemptCount > 0 && redirectUrl === undefined && lastError !== undefined) {
        await sleep(jitteredDelay(this.retryBaseDelay, attemptCount - 1))
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        controller.abort()
      }, timeout)

      const cleanup = linkSignals(controller, this.clientController.signal, options.signal)

      try {
        const response = await this.fetchFn(url, {
          method: options.method,
          headers,
          body: bodyStr,
          signal: controller.signal,
          redirect: "manual"
        })

        // Handle leader redirects (301/307)
        const redirectResult = this.maybeRedirect(response)
        if (redirectResult !== undefined) {
          if (!redirectResult.ok) {
            return redirectResult
          }
          redirectUrl = redirectResult.value
          lastError = new ConnectionError("leader redirect", { url: redirectUrl })
          redirects++
          continue
        }

        const result = await handleResponse<T>(response, url)

        // On success, trigger background peer discovery (once only).
        if (result.ok) {
          redirectUrl = undefined
          if (this.clusterDiscovery && !this._peersDiscovered) {
            this._peersDiscovered = true
            this.refreshPeers(baseUrl)
          }
        }

        return result
      } catch (error) {
        lastError = mapFetchError(error, url)
        redirectUrl = undefined
        // Advance to the next peer (wrapping around), then increment attempt count.
        peerIndex = (peerIndex + 1) % peers.length
        attemptCount++
      } finally {
        clearTimeout(timeoutId)
        cleanup()
      }
    }

    return err(lastError ?? new ConnectionError("max retries exceeded"))
  }

  /**
   * Send a GET request to a text endpoint (e.g. `/readyz`) and parse the ready state.
   *
   * Unlike `request()`, this treats HTTP 503 as a valid "not ready" response
   * rather than an error. Includes retry and redirect support.
   */
  private async requestText(
    path: string,
    params?: Record<string, string>,
    signal?: AbortSignal
  ): Promise<Result<ReadyResult, ClientError>> {
    if (this._destroyed) {
      return err(new ConnectionError("client is destroyed"))
    }

    const timeout = this.defaultTimeout

    const headers: Record<string, string> = {}
    if (this.authHeader !== undefined) {
      headers.Authorization = this.authHeader
    }

    let lastError: ClientError | undefined
    let redirects = 0

    const { peers } = this
    let peerIndex = 0
    let attemptCount = 0
    let redirectUrl: string | undefined

    while (attemptCount <= this.maxRetries && redirects <= this.maxRedirects) {
      const baseUrl = redirectUrl ?? peers[peerIndex % peers.length]
      const url = buildUrl(baseUrl, path, params)

      if (attemptCount > 0 && redirectUrl === undefined && lastError !== undefined) {
        await sleep(jitteredDelay(this.retryBaseDelay, attemptCount - 1))
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        controller.abort()
      }, timeout)

      const cleanup = linkSignals(controller, this.clientController.signal, signal)

      try {
        const response = await this.fetchFn(url, {
          method: "GET",
          headers,
          signal: controller.signal,
          redirect: "manual"
        })

        // Handle leader redirects
        const redirectResult = this.maybeRedirect(response)
        if (redirectResult !== undefined) {
          if (!redirectResult.ok) {
            return redirectResult
          }
          redirectUrl = redirectResult.value
          lastError = new ConnectionError("leader redirect", { url: redirectUrl })
          redirects++
          continue
        }

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
        lastError = mapFetchError(error, url)
        redirectUrl = undefined
        peerIndex = (peerIndex + 1) % peers.length
        attemptCount++
      } finally {
        clearTimeout(timeoutId)
        cleanup()
      }
    }

    return err(lastError ?? new ConnectionError("max retries exceeded"))
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

/** Build a full URL from a base URL, path, and optional query params. */
function buildUrl(baseUrl: string, path: string, params?: Record<string, string>): string {
  const url = new URL(path, baseUrl)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }
  return url.toString()
}

/**
 * Normalise an `api_addr` value to a base URL using the given scheme.
 *
 * rqlite's `/nodes` response returns `api_addr` values that may or may not
 * include a scheme (e.g. `"http://localhost:4001"` or `"localhost:4001"`).
 * This ensures the result is always a valid base URL.
 */
function normaliseBaseUrl(apiAddr: string, scheme: string): string {
  if (apiAddr.startsWith("http://") || apiAddr.startsWith("https://")) {
    // Strip any trailing path so we get a clean base URL.
    const parsed = new URL(apiAddr)
    return `${parsed.protocol}//${parsed.host}`
  }
  return `${scheme}://${apiAddr}`
}

/**
 * Build the initial ordered peer list from the primary host and optional seed hosts.
 * The primary host is always first.
 */
function buildPeerList(scheme: string, host: string, extraHosts?: string[]): string[] {
  const primary = `${scheme}://${host}`
  if (extraHosts === undefined || extraHosts.length === 0) {
    return [primary]
  }
  const extras = extraHosts.map((h) => normaliseBaseUrl(h, scheme)).filter((u) => u !== primary)
  return [primary, ...extras]
}

/** Encode basic auth credentials as a header value (UTF-8 safe). */
function encodeBasicAuth(auth: RqliteAuth): string {
  const credentials = `${auth.username}:${auth.password}`
  const encoded = new TextEncoder().encode(credentials)
  let binary = ""
  for (const byte of encoded) {
    binary += String.fromCharCode(byte)
  }
  return `Basic ${btoa(binary)}`
}

/**
 * Validate a redirect Location URL against allowed schemes.
 * Returns the URL string if valid, or `undefined` if disallowed.
 */
function validateRedirectUrl(location: string, allowedSchemes: Set<string>): string | undefined {
  try {
    const parsed = new URL(location)
    if (!allowedSchemes.has(parsed.protocol)) {
      return undefined
    }
    return parsed.toString()
  } catch {
    return undefined
  }
}

/**
 * Link external abort signals to a per-request controller.
 * Returns a cleanup function that removes all listeners.
 */
function linkSignals(target: AbortController, ...signals: (AbortSignal | undefined)[]): () => void {
  const handlers: [AbortSignal, () => void][] = []
  for (const signal of signals) {
    if (signal === undefined) {
      continue
    }
    const handler = (): void => {
      target.abort()
    }
    signal.addEventListener("abort", handler)
    handlers.push([signal, handler])
    if (signal.aborted) {
      target.abort()
    }
  }
  return () => {
    for (const [signal, handler] of handlers) {
      signal.removeEventListener("abort", handler)
    }
  }
}

/** Sleep for the given number of milliseconds. */
async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return
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
