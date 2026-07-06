---
description:
  "Fixed spelling/capitalization and writing-style conventions that recur across every repo"
applyTo: "**"
---

# Terminology

Fixed spelling/capitalization for names that recur across prose — comments, docs, commit/PR text,
error messages, UI copy. This governs **prose**, not identifiers; apply the carve-out below before
"fixing" anything.

## Terseness

Lean terse everywhere. Cut anything that doesn't change what the reader does; prefer wording that
won't go stale over specific numbers, examples, or snapshots of current state.

## Qualithm

"Qualithm" is a proper noun — always capitalized in running text ("the Qualithm platform"). Paired
with a product noun it names a specific product, so capitalize that noun too: "Qualithm Platform",
"Qualithm ID", "Qualithm Device SDK". Don't downcase the product word when you mean the product
itself. A bare generic reference ("the platform", "the device SDK") is fine when you're not naming a
specific product.

## Identifier carve-out

Leave it lowercase wherever it's a literal, case-sensitive identifier the platform dictates —
capitalizing would break a real reference, not just look nicer:

- GitHub org slug `qualithm`; npm scope `@qualithm/*`; Go module paths (`github.com/qualithm/…`)
- the `qualithm` / `qualithm-mcp` CLI binary names and their `// Command qualithm is …` doc comments
- Docker image names, package names, domains/URLs

Test: "if I capitalized this, would it break a real reference?" Yes → identifier, leave it. No, it's
just narrating → prose, capitalize it.

## Derived display names

A human-facing title derived from a kebab-case identifier doesn't inherit that casing — title-case
it. E.g. a script's `user-agent` value is correctly `qualithm-cost-analysis` (an identifier —
software matches it verbatim), but that same script's output `creator` metadata, which a person
reads, should be `"Qualithm Cost Analysis"`. Same test: does software match the value verbatim, or
does a person read it as a name? If a person reads it, title-case it.

## File extensions

Use the full extension, not the shorthand: `.yaml` (not `.yml`) — including GitHub composite actions
(`action.yaml`), even though GitHub scaffolds `action.yml`.
