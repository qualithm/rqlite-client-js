/**
 * Cluster failover example.
 *
 * Demonstrates leader redirect handling, node health checks, and cluster inspection.
 *
 * Requires a running rqlite cluster (`docker compose up -d`).
 *
 * @example
 * ```bash
 * bun run examples/cluster-failover.ts
 * ```
 */

/* eslint-disable no-console */

import { ConnectionError, createRqliteClient } from "@qualithm/rqlite-client"

async function main(): Promise<void> {
  console.log("=== Cluster Failover ===\n")

  // Leader redirects are followed automatically (default behaviour)
  const client = createRqliteClient({
    host: "localhost:4001",
    followRedirects: true, // default
    maxRetries: 5,
    retryBaseDelay: 200
  })

  // Check if the node is ready
  console.log("--- Node readiness ---")
  const ready = await client.ready()
  if (ready.ok) {
    console.log(`  Ready: ${String(ready.value.ready)}`)
    console.log(`  Is leader: ${String(ready.value.isLeader)}`)
  } else {
    console.log(`  Health check failed: ${ready.error.message}`)
  }

  // Check readiness without requiring a leader (useful during elections)
  console.log("\n--- Readiness without leader ---")
  const noLeader = await client.ready({ noleader: true })
  if (noLeader.ok) {
    console.log(`  Ready (no leader required): ${String(noLeader.value.ready)}`)
  }

  // List all nodes in the cluster
  console.log("\n--- Cluster nodes ---")
  const nodes = await client.nodes()
  if (nodes.ok) {
    for (const node of nodes.value) {
      const role = node.leader ? "leader" : "follower"
      const status = node.reachable ? "reachable" : "unreachable"
      console.log(`  ${node.id} (${role}, ${status}) — ${node.apiAddr}`)
    }
  } else {
    console.log(`  Failed to list nodes: ${nodes.error.message}`)
  }

  // Include non-voter nodes
  console.log("\n--- All nodes (including non-voters) ---")
  const allNodes = await client.nodes({ nonvoters: true })
  if (allNodes.ok) {
    console.log(`  Total nodes: ${String(allNodes.value.length)}`)
  }

  // Get detailed node status
  console.log("\n--- Node status ---")
  const status = await client.status()
  if (status.ok) {
    const store = status.value.store as Record<string, unknown> | undefined
    if (store !== undefined) {
      console.log(`  Raft state: ${String(store.raft)}`)
    }
  }

  // Demonstrate retry behaviour on connection failure
  console.log("\n--- Retry on failure ---")
  const unreachable = createRqliteClient({
    host: "localhost:9999",
    maxRetries: 2,
    retryBaseDelay: 100,
    timeout: 1000
  })
  const fail = await unreachable.query("SELECT 1")
  if (!fail.ok && ConnectionError.isError(fail.error)) {
    console.log(`  Failed after retries: ${fail.error.message}`)
  }

  console.log("\nDone.")
}

main().catch(console.error)
