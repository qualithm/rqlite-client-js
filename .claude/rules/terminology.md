---
description:
  "Fixed spelling/capitalization and writing-style conventions that recur across every repo"
---

# Terminology

Applies to prose — comments, docs, commit/PR text, error messages, UI copy — never to identifiers.

- **Terse.** Cut anything that doesn't change what the reader does. Prefer wording that won't go
  stale over specific numbers, examples, or snapshots of current state.
- **Qualithm** is a proper noun, always capitalized in running text. Paired with a product noun,
  capitalize that too: "Qualithm Platform", "Qualithm ID", "Qualithm Device SDK". A generic "the
  platform" stays lowercase.
- **Identifier carve-out.** Leave literal, case-sensitive identifiers as they are: the `qualithm`
  org slug, `@qualithm/*`, Go module paths, the `qualithm`/`qualithm-mcp` binaries and their
  `// Command qualithm is …` doc comments, image and package names, domains. Test: would
  capitalizing it break a real reference?
- **Derived display names** are title-cased where a person reads them: a `user-agent` of
  `qualithm-cost-analysis` stays as is, but its `creator` metadata reads "Qualithm Cost Analysis".
- **`.yaml`, never `.yml`** — including `action.yaml`.
- **Env var vendor prefixes are spelled out**: `GITHUB_`, `CLOUDFLARE_`, `DIGITALOCEAN_`, never
  `GH_`, `CF_`, `DO_`. Keep a short name only when an external tool reads it verbatim (`GH_TOKEN`,
  `GH_PAGER`, `AWS_ACCESS_KEY_ID`, `secrets.GITHUB_TOKEN`).
