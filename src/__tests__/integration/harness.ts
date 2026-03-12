/**
 * Integration test harness for rqlite.
 *
 * Manages an rqlite Docker container for integration tests. The container
 * is started once before all tests and stopped after.
 *
 * Requires Docker to be running.
 */

import { execSync } from "node:child_process"
import { resolve } from "node:path"

const COMPOSE_FILE = resolve(import.meta.dirname, "../../../docker-compose.test.yml")
const RQLITE_HOST = "localhost:4001"
const HEALTH_CHECK_INTERVAL = 500
const HEALTH_CHECK_TIMEOUT = 30_000

/** Start the rqlite Docker container via docker compose. */
export function startRqlite(): void {
  try {
    execSync(`docker compose -f ${COMPOSE_FILE} up -d --wait`, {
      stdio: "pipe"
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`failed to start rqlite container: ${message}`, {
      cause: error
    })
  }
}

/** Stop and remove the rqlite Docker container. */
export function stopRqlite(): void {
  execSync(`docker compose -f ${COMPOSE_FILE} down -v`, {
    stdio: "pipe"
  })
}

/** Wait for rqlite to become ready by polling the /readyz endpoint. */
export async function waitForReady(): Promise<void> {
  const deadline = Date.now() + HEALTH_CHECK_TIMEOUT

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${RQLITE_HOST}/readyz`)
      if (response.status === 200) {
        return
      }
    } catch {
      // Not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_INTERVAL))
  }

  throw new Error(`rqlite did not become ready within ${String(HEALTH_CHECK_TIMEOUT)}ms`)
}

/** Get the rqlite host address for test clients. */
export function getRqliteHost(): string {
  return RQLITE_HOST
}
