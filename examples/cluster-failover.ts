/**
 * Cluster failover example.
 *
 * Demonstrates leader redirect handling, node health checks, cluster inspection,
 * and cluster discovery with multiple seed hosts.
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

  // Connect with a seed host list. If localhost:4001 is unreachable, the client
  // will try localhost:4003 and localhost:4005 before giving up.
  // After the first successful request, /nodes is queried in the background and
  // the peer list is updated with the authoritative cluster membership.
  const client = createRqliteClient({
    host: "localhost:4001",
    hosts: ["localhost:4003", "localhost:4005"],
    followRedirects: true, // default
    clusterDiscovery: true, // default
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

  // Disable cluster discovery when a load balancer handles node selection.
  // The client will only ever talk to the single configured host.
  console.log("\n--- Behind a load balancer (discovery disabled) ---")
  const lbClient = createRqliteClient({
    host: "my-rqlite-lb:4001",
    clusterDiscovery: false,
    timeout: 5000
  })
  const lbReady = await lbClient.ready()
  console.log(`  Load balancer ready: ${String(lbReady.ok ? lbReady.value.ready : false)}`)

  // Demonstrate retry behaviour on connection failure
  console.log("\n--- Retry on failure ---")
  const unreachable = createRqliteClient({
    host: "localhost:9999",
    hosts: ["localhost:9998", "localhost:9997"],
    maxRetries: 2,
    retryBaseDelay: 100,
    timeout: 1000
  })
  const fail = await unreachable.query("SELECT 1")
  if (!fail.ok && ConnectionError.isError(fail.error)) {
    console.log(`  Failed after retries across all peers: ${fail.error.message}`)
  }

  console.log("\nDone.")
}

main().catch(console.error)
