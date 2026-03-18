/**
 * mTLS (mutual TLS) example.
 *
 * Demonstrates injecting a custom fetch function to enable client certificate
 * authentication for Node.js, Bun, and Deno runtimes.
 *
 * Requires a running rqlite node configured with mTLS.
 *
 * @example
 * ```bash
 * bun run examples/mtls.ts
 * ```
 */

/* eslint-disable no-console */

import { readFileSync } from "node:fs"

import { createRqliteClient } from "@qualithm/rqlite-client"

// Load client certificate and key from disk.
function loadCredentials(): { ca: string; cert: string; key: string } {
  return {
    ca: readFileSync("certs/ca.pem", "utf-8"),
    cert: readFileSync("certs/client-cert.pem", "utf-8"),
    key: readFileSync("certs/client-key.pem", "utf-8")
  }
}

async function main(): Promise<void> {
  console.log("=== mTLS (Custom Fetch) ===\n")

  const { ca, cert, key } = loadCredentials()

  // -------------------------------------------------------------------------
  // Node.js — use undici Agent to attach client certificates.
  //
  //   import { Agent, fetch as undiciFetch } from "undici"
  //   const agent = new Agent({ connect: { ca, cert, key } })
  //   const customFetch: typeof fetch = (input, init) =>
  //     undiciFetch(input, { ...init, dispatcher: agent })
  //
  // -------------------------------------------------------------------------
  // Bun — pass tls options directly in the fetch init.
  //
  //   const customFetch: typeof fetch = (input, init) =>
  //     fetch(input, { ...init, tls: { ca, cert, key } })
  //
  // -------------------------------------------------------------------------
  // Deno — create an HttpClient with cert options.
  //
  //   const httpClient = Deno.createHttpClient({ caCerts: [ca], certChain: cert, privateKey: key })
  //   const customFetch: typeof fetch = (input, init) =>
  //     fetch(input, { ...init, client: httpClient })
  //
  // -------------------------------------------------------------------------

  // Generic example using global fetch as a stand-in.
  // Replace with the appropriate runtime-specific fetch from above.
  const customFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    console.log("  Custom fetch called for:", url)
    void ca
    void cert
    void key
    return fetch(input, init)
  }) as typeof fetch

  console.log("--- Creating client with custom fetch ---")
  const client = createRqliteClient({
    host: "localhost:4001",
    tls: true,
    fetch: customFetch
  })

  const result = await client.ready()
  if (result.ok) {
    console.log(`  Node ready: ${String(result.value.ready)}`)
  } else {
    console.log(`  Connection failed: ${result.error.message}`)
  }

  console.log("\nDone.")
}

main().catch(console.error)
