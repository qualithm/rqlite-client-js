/**
 * Benchmarks entry point.
 *
 * Run with: bun run bench
 *
 * Example with configuration:
 *   WARMUP_ITERATIONS=20 BENCH_ITERATIONS=1000 bun run bench
 */

/* eslint-disable no-console */

import { greet } from "../src/greet"

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
  console.log("=== greet() Benchmarks ===\n")
  console.log(`Warmup iterations: ${String(config.warmupIterations)}`)
  console.log(`Benchmark iterations: ${config.benchmarkIterations.toLocaleString()}\n`)

  const results: BenchmarkResult[] = []

  // Benchmark informal greeting
  const informalResult = runBenchmark(
    "greet (informal)",
    () => greet({ name: "World" }),
    config.benchmarkIterations,
    config.warmupIterations
  )
  results.push(informalResult)
  formatResult(informalResult)

  // Benchmark formal greeting
  const formalResult = runBenchmark(
    "greet (formal)",
    () => greet({ name: "World", formal: true }),
    config.benchmarkIterations,
    config.warmupIterations
  )
  results.push(formalResult)
  formatResult(formalResult)

  // Benchmark with longer name
  const longNameResult = runBenchmark(
    "greet (long name)",
    () => greet({ name: "The Quick Brown Fox Jumps Over The Lazy Dog" }),
    config.benchmarkIterations,
    config.warmupIterations
  )
  results.push(longNameResult)
  formatResult(longNameResult)

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
