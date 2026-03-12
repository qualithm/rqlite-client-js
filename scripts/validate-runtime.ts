#!/usr/bin/env bun
/**
 * Cross-runtime validation script.
 *
 * Tests that the library can be imported and used correctly across
 * different JavaScript runtimes (Bun, Node.js, Deno).
 *
 * Run with: bun run scripts/validate-runtime.ts
 */

import { spawn } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

// ── Test Code ─────────────────────────────────────────────────────────

function getTestCode(importPath: string): string {
  return `
import {
  RqliteClient,
  createRqliteClient,
  ok,
  err,
  isOk,
  isErr,
  RqliteError,
  ConnectionError,
  QueryError,
  AuthenticationError,
} from "${importPath}";

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error("FAIL:", label);
  }
}

// Check exports exist
assert(typeof RqliteClient === "function", "RqliteClient is a function");
assert(typeof createRqliteClient === "function", "createRqliteClient is a function");
assert(typeof ok === "function", "ok is a function");
assert(typeof err === "function", "err is a function");
assert(typeof isOk === "function", "isOk is a function");
assert(typeof isErr === "function", "isErr is a function");
assert(typeof RqliteError === "function", "RqliteError is a function");
assert(typeof ConnectionError === "function", "ConnectionError is a function");
assert(typeof QueryError === "function", "QueryError is a function");
assert(typeof AuthenticationError === "function", "AuthenticationError is a function");

// Test Result helpers
const okResult = ok(42);
assert(isOk(okResult) === true, "isOk returns true for ok result");
assert(okResult.value === 42, "ok result contains value");

const errResult = err(new Error("test"));
assert(isErr(errResult) === true, "isErr returns true for err result");

// Test client construction
try {
  const client = new RqliteClient({ host: "localhost:4001" });
  assert(client instanceof RqliteClient, "RqliteClient constructor works");
} catch (error) {
  failed++;
  console.error("FAIL: RqliteClient constructor threw:", error);
}

// Test factory function
try {
  const client = createRqliteClient({ host: "localhost:4001" });
  assert(client instanceof RqliteClient, "createRqliteClient works");
} catch (error) {
  failed++;
  console.error("FAIL: createRqliteClient threw:", error);
}

// Test error hierarchy
try {
  const connErr = new ConnectionError("test connection error");
  assert(ConnectionError.isError(connErr), "ConnectionError.isError works");
  assert(RqliteError.isError(connErr), "ConnectionError is RqliteError");

  const queryErr = new QueryError("test query error");
  assert(QueryError.isError(queryErr), "QueryError.isError works");

  const authErr = new AuthenticationError("test auth error");
  assert(AuthenticationError.isError(authErr), "AuthenticationError.isError works");
} catch (error) {
  failed++;
  console.error("FAIL: error hierarchy threw:", error);
}

// Test TLS configuration
try {
  const client = new RqliteClient({ host: "localhost:4001", tls: true });
  assert(client instanceof RqliteClient, "TLS client construction works");
} catch (error) {
  failed++;
  console.error("FAIL: TLS client construction threw:", error);
}

console.log(\`Passed: \${passed}, Failed: \${failed}\`);
process.exit(failed > 0 ? 1 : 0);
`.trim()
}

// ── Runtime Detection ─────────────────────────────────────────────────

type RuntimeInfo = {
  name: string
  command: string
  args: string[]
  available: boolean
  version?: string
}

async function checkRuntime(
  name: string,
  command: string,
  versionArg: string
): Promise<RuntimeInfo> {
  return new Promise((resolve) => {
    const proc = spawn(command, [versionArg], { stdio: ["ignore", "pipe", "ignore"] })
    let version = ""

    proc.stdout.on("data", (data: Buffer) => {
      version += data.toString()
    })

    proc.on("error", () => {
      resolve({ name, command, args: [], available: false })
    })

    proc.on("close", (code) => {
      resolve({
        name,
        command,
        args: [],
        available: code === 0,
        version: version.trim().split("\n")[0]
      })
    })
  })
}

// ── Test Runner ───────────────────────────────────────────────────────

async function runTest(
  runtime: RuntimeInfo,
  testFile: string,
  testDir: string,
  importMapPath: string
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    let args = [...runtime.args]
    // Add import map for Deno
    if (runtime.name === "Deno") {
      args = ["run", "--allow-read", "--allow-env", "--allow-net", `--import-map=${importMapPath}`]
    }
    args.push(testFile)

    const proc = spawn(runtime.command, args, { cwd: testDir, stdio: ["ignore", "pipe", "pipe"] })
    let output = ""

    proc.stdout.on("data", (data: Buffer) => {
      output += data.toString()
    })
    proc.stderr.on("data", (data: Buffer) => {
      output += data.toString()
    })

    proc.on("error", (error) => {
      resolve({ success: false, output: error.message })
    })

    proc.on("close", (code) => {
      resolve({ success: code === 0, output: output.trim() })
    })
  })
}

// ── Main ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Cross-Runtime Validation")
  console.log("========================\n")

  // Check available runtimes
  const runtimes: RuntimeInfo[] = await Promise.all([
    checkRuntime("Bun", "bun", "--version").then((r) => ({ ...r, args: ["run"] })),
    checkRuntime("Node.js", "node", "--version").then((r) => ({
      ...r,
      args: ["--experimental-vm-modules"]
    })),
    checkRuntime("Deno", "deno", "--version").then((r) => ({
      ...r,
      args: ["run", "--allow-read", "--allow-env", "--allow-net", "--node-modules-dir=auto"]
    }))
  ])

  console.log("Available runtimes:")
  for (const runtime of runtimes) {
    const status = runtime.available ? `✓ ${runtime.version ?? "unknown"}` : "✗ not found"
    console.log(`  ${runtime.name}: ${status}`)
  }
  console.log()

  const available = runtimes.filter((r) => r.available)
  if (available.length === 0) {
    console.error("No runtimes available for testing")
    process.exit(1)
  }

  // Create temporary test directory
  const tmpDir = await mkdtemp(join(tmpdir(), "rqlite-client-test-"))
  const distPath = join(process.cwd(), "dist", "index.js")

  try {
    // Write test file that imports directly from dist using absolute path
    const testFile = join(tmpDir, "test.mjs")
    await writeFile(testFile, getTestCode(distPath))

    // Create import map for Deno (no external dependencies needed)
    const importMapPath = join(tmpDir, "import_map.json")
    await writeFile(
      importMapPath,
      JSON.stringify({
        imports: {}
      })
    )

    // Run tests
    console.log("Running validation tests:")
    console.log("-".repeat(40))

    let passed = 0
    let failed = 0

    for (const runtime of available) {
      process.stdout.write(`${runtime.name}: `)
      const result = await runTest(runtime, testFile, tmpDir, importMapPath)

      if (result.success) {
        console.log("✓ PASS")
        passed++
      } else {
        console.log("✗ FAIL")
        console.log(`  Output: ${result.output}`)
        failed++
      }
    }

    console.log("-".repeat(40))
    console.log()
    console.log(`Results: ${String(passed)} passed, ${String(failed)} failed`)
    console.log()

    if (failed > 0) {
      process.exit(1)
    }
  } finally {
    // Cleanup
    await rm(tmpDir, { recursive: true, force: true })
  }
}

main().catch((error: unknown) => {
  console.error("Validation failed:", error)
  process.exit(1)
})
