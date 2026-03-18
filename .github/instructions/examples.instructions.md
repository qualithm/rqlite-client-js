---
description: "Conventions for runnable example files"
applyTo: "examples/**"
---

# Example Conventions

## File Structure

1. JSDoc block: title, one-sentence description, optional prerequisites, `@example` with `bun run`
2. `/* eslint-disable no-console */`
3. Imports from the package's public API
4. Helper functions with `// Verb phrase with period.` comment above
5. `main()` function as the single entry point

## main() Pattern

- Synchronous: `function main(): void` called via `main()`
- Asynchronous: `async function main(): Promise<void>` called via `main().catch(console.error)`
- Server (long-running): wrap setup in `main()` — no "Done." epilogue

## Console Output

- Title: `console.log("=== Title ===\n")`
- Section: `console.log("--- Section ---")`
- Output: `console.log("  Result: ...")` (2-space indent)
- Epilogue: `console.log("\nDone.")` (script examples only)

## README

Each `examples/` directory has a `README.md` with:

1. `# Examples` heading
2. Brief intro: "Runnable examples demonstrating [package] usage."
3. `## Prerequisites` (if external services required)
4. `## Environment Variables` table (if any)
5. `## Running Examples` with `bun run` commands
6. `## Example Files` table: `| File | Description |`
