#!/usr/bin/env bun
/**
 * Demo script showcasing the npm-example package.
 *
 * Run with: bun run demo
 */

import { greet } from "../src/index.js"

console.log("npm-example Demo")
console.log("================\n")

// Casual greeting
const casual = greet({ name: "World" })
console.log("Casual:", casual)

// Formal greeting
const formal = greet({ name: "Professor Smith", formal: true })
console.log("Formal:", formal)

// Interactive example
const name = process.argv[2] || "Developer"
console.log(`\nCustom: ${greet({ name })}`)
