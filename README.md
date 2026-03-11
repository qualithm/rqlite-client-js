# Rqlite Client

[![CI](https://github.com/qualithm/rqlite-client-js/actions/workflows/ci.yaml/badge.svg)](https://github.com/qualithm/rqlite-client-js/actions/workflows/ci.yaml)
[![codecov](https://codecov.io/gh/qualithm/rqlite-client-js/graph/badge.svg)](https://codecov.io/gh/qualithm/rqlite-client-js)
[![npm](https://img.shields.io/npm/v/@qualithm/rqlite-client)](https://www.npmjs.com/package/@qualithm/rqlite-client)

Native rqlite client for JavaScript and TypeScript runtimes. Implements the rqlite HTTP API for
executing SQL statements, querying data, and managing cluster operations.

## Development

### Prerequisites

- [Bun](https://bun.sh/) (recommended), Node.js 20+, or [Deno](https://deno.land/)

### Setup

```bash
bun install
```

### Building

```bash
bun run build
```

### Testing

```bash
bun test
```

### Linting & Formatting

```bash
bun run lint
bun run format
bun run typecheck
```

### Benchmarks

```bash
bun run bench
```

## Publishing

The package is automatically published to NPM when CI passes on main. Update the version in
`package.json` before merging to trigger a new release.

## Licence

Apache-2.0
