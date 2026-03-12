#!/usr/bin/env bun
/**
 * Bundle size analysis script.
 *
 * Analyses the library's bundle size impact and tree-shaking effectiveness.
 *
 * Run with: bun run scripts/analyze-bundle.ts
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { gzipSync } from "node:zlib"

// ── Size Utilities ────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function getFileSize(path: string): number {
  return statSync(path).size
}

function getGzipSize(path: string): number {
  const content = readFileSync(path)
  return gzipSync(content, { level: 9 }).length
}

function walkDir(dir: string, ext: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkDir(path, ext))
    } else if (entry.name.endsWith(ext)) {
      files.push(path)
    }
  }
  return files
}

// ── Analysis ──────────────────────────────────────────────────────────

console.log("Bundle Size Analysis")
console.log("====================\n")

const distDir = "dist"
const jsFiles = walkDir(distDir, ".js")
const dtsFiles = walkDir(distDir, ".d.ts")

// Calculate totals
let totalRaw = 0
let totalGzip = 0

const fileSizes: { path: string; raw: number; gzip: number }[] = []

for (const file of jsFiles) {
  const raw = getFileSize(file)
  const gzip = getGzipSize(file)
  totalRaw += raw
  totalGzip += gzip
  fileSizes.push({ path: file.replace(`${distDir}/`, ""), raw, gzip })
}

// Sort by raw size descending
fileSizes.sort((a, b) => b.raw - a.raw)

console.log("JavaScript Files (sorted by size):")
console.log("-".repeat(60))
console.log("File".padEnd(40) + "Raw".padStart(10) + "Gzip".padStart(10))
console.log("-".repeat(60))

for (const { path, raw, gzip } of fileSizes) {
  console.log(path.padEnd(40) + formatBytes(raw).padStart(10) + formatBytes(gzip).padStart(10))
}

console.log("-".repeat(60))
console.log(
  "Total".padEnd(40) + formatBytes(totalRaw).padStart(10) + formatBytes(totalGzip).padStart(10)
)
console.log()

// Type definitions
let totalDts = 0
for (const file of dtsFiles) {
  totalDts += getFileSize(file)
}

console.log("Type Definitions:")
console.log(`  Files: ${String(dtsFiles.length)}`)
console.log(`  Total: ${formatBytes(totalDts)}`)
console.log()

// Tree-shaking scenarios
console.log("Tree-Shaking Impact (estimated):")
console.log("-".repeat(60))

const scenarios = [
  {
    name: "Client only",
    includes: ["client.js", "result.js", "errors.js", "types.js", "index.js"]
  },
  {
    name: "Full library (no testing)",
    includes: jsFiles.map((f) => f.replace(`${distDir}/`, "")).filter((f) => !f.includes("testing"))
  },
  {
    name: "Full library (with testing)",
    includes: jsFiles.map((f) => f.replace(`${distDir}/`, ""))
  }
]

for (const scenario of scenarios) {
  let raw = 0
  let gzip = 0
  for (const file of scenario.includes) {
    const fullPath = join(distDir, file)
    try {
      raw += getFileSize(fullPath)
      gzip += getGzipSize(fullPath)
    } catch {
      // File doesn't exist in this scenario
    }
  }
  console.log(
    `${`${scenario.name}:`.padEnd(35) + formatBytes(raw).padStart(12)} (${formatBytes(gzip)} gzip)`
  )
}

console.log()
console.log("Note: Actual bundle size depends on bundler and tree-shaking effectiveness.")
console.log("The library uses named exports throughout to maximise tree-shaking potential.")
