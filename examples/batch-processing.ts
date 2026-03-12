/**
 * Batch processing example.
 *
 * Demonstrates processing multiple items efficiently.
 *
 * @example
 * ```bash
 * bun run examples/batch-processing.ts
 * ```
 */

/* eslint-disable no-console */

import { greet } from "@qualithm/rqlite-client"

type Person = {
  name: string
  title?: string
  formal?: boolean
}

/**
 * Generate greeting for a person, using title if available.
 */
function greetPerson(person: Person): string {
  const displayName = person.title !== undefined ? `${person.title} ${person.name}` : person.name
  return greet({ name: displayName, formal: person.formal })
}

/**
 * Process multiple people and return all greetings.
 */
function greetAll(people: Person[]): string[] {
  return people.map(greetPerson)
}

/**
 * Process people with progress callback.
 */
function greetAllWithProgress(
  people: Person[],
  onProgress: (current: number, total: number, result: string) => void
): string[] {
  const results: string[] = []
  const total = people.length

  for (let i = 0; i < people.length; i++) {
    const result = greetPerson(people[i])
    results.push(result)
    onProgress(i + 1, total, result)
  }

  return results
}

function main(): void {
  console.log("=== Batch Processing Examples ===\n")

  // Sample data
  const people: Person[] = [
    { name: "Alice", formal: false },
    { name: "Bob", title: "Mr.", formal: true },
    { name: "Carol", title: "Dr.", formal: true },
    { name: "Dave" },
    { name: "Eve", title: "Prof.", formal: true }
  ]

  // Example 1: Simple batch processing
  console.log("--- Example 1: Simple Batch ---")
  const greetings = greetAll(people)
  for (const greeting of greetings) {
    console.log(`  ${greeting}`)
  }
  console.log()

  // Example 2: With progress tracking
  console.log("--- Example 2: With Progress ---")
  greetAllWithProgress(people, (current, total, result) => {
    const percent = ((current / total) * 100).toFixed(0)
    console.log(`  [${percent.padStart(3)}%] ${result}`)
  })
  console.log()

  // Example 3: Filter and transform
  console.log("--- Example 3: Filter Formal Only ---")
  const formalPeople = people.filter((p) => p.formal === true)
  const formalGreetings = greetAll(formalPeople)
  console.log(`  Found ${String(formalGreetings.length)} formal greetings:`)
  for (const greeting of formalGreetings) {
    console.log(`    ${greeting}`)
  }
  console.log()

  // Example 4: Reduce to single message
  console.log("--- Example 4: Combined Message ---")
  const allNames = people.map((p) => p.name).join(", ")
  const combinedGreeting = greet({ name: `everyone (${allNames})` })
  console.log(`  ${combinedGreeting}`)

  console.log("\nExamples complete.")
}

main()
