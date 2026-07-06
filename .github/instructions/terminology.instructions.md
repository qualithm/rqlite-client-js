---
description:
  "Fixed spelling/capitalization and writing-style conventions that recur across every repo"
applyTo: "**"
---

# Terminology

Fixed spelling/capitalization for names that recur everywhere — comments, docs, commit messages,
error messages, UI copy. This is about **prose**, not identifiers; read the carve-out below before
"fixing" something that isn't a mistake.

## Terseness

Lean terse everywhere — docs, comments, commit/PR text, instructions. Cut anything that doesn't
change what the reader does with it; prefer wording unlikely to go stale over specific numbers,
examples, or snapshots of current state.

## Qualithm

"Qualithm" is a proper noun — always capitalized in running text: "the Qualithm platform", not "the
qualithm platform". When paired with a product noun it names a specific product, so capitalize that
noun too: "Qualithm Platform", "Qualithm ID", "Qualithm Device SDK". Don't downcase the product word
to a generic noun when you mean the product itself — "the qualithm platform" → "Qualithm Platform".
A bare generic reference ("the platform", "the device SDK") is fine when you're not naming the
specific product.

## Identifier carve-out

Leave it lowercase wherever it's a literal, case-sensitive identifier dictated by the platform, not
a prose choice — capitalizing these would break a real reference, not just look nicer:

- GitHub org slug: `qualithm` (org URL, `gh api graphql owner: "qualithm"`, etc.)
- npm scope: `@qualithm/device`, `@qualithm/shared`, …
- Go module paths: `github.com/qualithm/operator-go`, …
- The `qualithm` / `qualithm-mcp` CLI binary names, and their `// Command qualithm is …` doc
  comments
- Docker image names, package names, domains/URLs

Test before changing anything: "if I capitalized this, would it break a real reference?" If yes,
it's an identifier — leave it. If it's just narrating in a sentence, it's prose — capitalize it.

## Derived display names

A human-facing title derived from a kebab-case identifier doesn't inherit that identifier's casing —
write it as a normal title instead. E.g. a script's `user-agent` HTTP header value is correctly
`qualithm-cost-analysis` (an identifier — software matches it verbatim), but that same script's
output-file `creator` metadata — a field a person reads in File → Properties — should be
`"Qualithm Cost Analysis"`, not `"Qualithm cost-analysis"`. Same test, applied to the field itself:
does software match this value verbatim, or does a person read it as a name? If a person reads it,
title-case it.

## File extensions

Use the complete extension, not its shorthand, when a filename isn't otherwise constrained: `.yaml`
(not `.yml`) — including for GitHub composite actions (`action.yaml`), even though GitHub's own
scaffolding defaults to `action.yml`.
