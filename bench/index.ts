/**
 * Benchmarks entry point.
 *
 * Run with: bun run bench
 *
 * Example with configuration:
 *   WARMUP_ITERATIONS=20 BENCH_ITERATIONS=1000 bun run bench
 */

/* eslint-disable no-console */

import { RqliteClient } from "../src/client"
import { ConnectionError, QueryError, RqliteError } from "../src/errors"
import { err, isErr, isOk, ok } from "../src/result"

const config = {
  warmupIterations: parseInt(process.env.WARMUP_ITERATIONS ?? "15", 10),
  benchmarkIterations: parseInt(process.env.BENCH_ITERATIONS ?? "100000", 10)
}

type BenchmarkResult = {
  name: string
  iterations: number
  totalMs: number
  avgMs: number
  minMs: number
  maxMs: number
  stdDev: number
  cv: number // coefficient of variation (%)
}

function calculateStats(times: number[]): {
  avg: number
  min: number
  max: number
  stdDev: number
  cv: number
} {
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  const min = Math.min(...times)
  const max = Math.max(...times)
  const variance = times.reduce((sum, t) => sum + (t - avg) ** 2, 0) / times.length
  const stdDev = Math.sqrt(variance)
  const cv = (stdDev / avg) * 100

  return { avg, min, max, stdDev, cv }
}

function runBenchmark(
  name: string,
  fn: () => void,
  iterations: number,
  warmupIterations: number
): BenchmarkResult {
  // Warmup phase
  for (let i = 0; i < warmupIterations; i++) {
    fn()
  }

  // Execute benchmark in batches for timing
  const batchSize = Math.max(1, Math.floor(iterations / 100))
  const batchTimes: number[] = []

  let remaining = iterations
  while (remaining > 0) {
    const batch = Math.min(batchSize, remaining)
    const start = performance.now()
    for (let i = 0; i < batch; i++) {
      fn()
    }
    const end = performance.now()
    batchTimes.push((end - start) / batch)
    remaining -= batch
  }

  const stats = calculateStats(batchTimes)
  const totalMs = batchTimes.reduce((a, b) => a + b, 0) * batchSize

  return {
    name,
    iterations,
    totalMs,
    avgMs: stats.avg,
    minMs: stats.min,
    maxMs: stats.max,
    stdDev: stats.stdDev,
    cv: stats.cv
  }
}

function formatResult(result: BenchmarkResult): void {
  console.log(`${result.name}:`)
  console.log(`  Iterations: ${result.iterations.toLocaleString()}`)
  console.log(`  Total time: ${result.totalMs.toFixed(2)}ms`)
  console.log(`  Per call:   ${(result.avgMs * 1000).toFixed(3)}μs`)
  console.log(`  Min:        ${(result.minMs * 1000).toFixed(3)}μs`)
  console.log(`  Max:        ${(result.maxMs * 1000).toFixed(3)}μs`)
  console.log(`  Std Dev:    ${(result.stdDev * 1000).toFixed(3)}μs`)
  console.log(`  CV:         ${result.cv.toFixed(2)}%`)
  console.log()
}

function main(): void {
  console.log("=== rqlite-client Benchmarks ===\n")
  console.log(`Warmup iterations: ${String(config.warmupIterations)}`)
  console.log(`Benchmark iterations: ${config.benchmarkIterations.toLocaleString()}\n`)

  const results: BenchmarkResult[] = []

  // Benchmark ok() result creation
  const okResult = runBenchmark(
    "ok() creation",
    () => ok({ lastInsertId: 1, rowsAffected: 1, time: 0.001 }),
    config.benchmarkIterations,
    config.warmupIterations
  )
  results.push(okResult)
  formatResult(okResult)

  // Benchmark err() result creation
  const errResult = runBenchmark(
    "err() creation",
    () => err(new ConnectionError("test error")),
    config.benchmarkIterations,
    config.warmupIterations
  )
  results.push(errResult)
  formatResult(errResult)

  // Benchmark isOk/isErr type narrowing
  const okVal = ok(42)
  const errVal = err(new ConnectionError("fail"))
  const isCheckResult = runBenchmark(
    "isOk/isErr check",
    () => {
      isOk(okVal)
      isErr(errVal)
    },
    config.benchmarkIterations,
    config.warmupIterations
  )
  results.push(isCheckResult)
  formatResult(isCheckResult)

  // Benchmark error class instantiation
  const errorResult = runBenchmark(
    "error instantiation",
    () => {
      new ConnectionError("connection refused", { url: "http://localhost:4001" })
      new QueryError("constraint failed")
    },
    config.benchmarkIterations,
    config.warmupIterations
  )
  results.push(errorResult)
  formatResult(errorResult)

  // Benchmark RqliteError.isError() type narrowing
  const connErr = new ConnectionError("test")
  const queryErr = new QueryError("test")
  const isErrorResult = runBenchmark(
    "isError() narrowing",
    () => {
      RqliteError.isError(connErr)
      ConnectionError.isError(connErr)
      QueryError.isError(queryErr)
    },
    config.benchmarkIterations,
    config.warmupIterations
  )
  results.push(isErrorResult)
  formatResult(isErrorResult)

  // Benchmark client construction
  const clientResult = runBenchmark(
    "client construction",
    () => new RqliteClient({ host: "localhost:4001" }),
    config.benchmarkIterations,
    config.warmupIterations
  )
  results.push(clientResult)
  formatResult(clientResult)

  // Summary
  console.log("=== Summary ===")
  console.log("Benchmark".padEnd(25) + "Avg (μs)".padStart(12) + "CV (%)".padStart(10))
  console.log("-".repeat(47))
  for (const r of results) {
    console.log(
      r.name.padEnd(25) + (r.avgMs * 1000).toFixed(3).padStart(12) + r.cv.toFixed(2).padStart(10)
    )
  }

  console.log("\nBenchmarks complete.")
}

main()
