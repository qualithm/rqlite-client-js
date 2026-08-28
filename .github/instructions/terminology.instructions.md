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
with a product noun it names a specific product, so capitalize that noun too. A bare generic
reference ("the platform") is fine when you're not naming a specific product.

## Identifier carve-out

Leave it lowercase wherever it's a literal, case-sensitive identifier the platform dictates —
capitalizing would break a real reference, not just look nicer:

- GitHub org slug `qualithm`; npm scope `@qualithm/*`; Go module paths (`github.com/qualithm/…`)
- Docker image names, package names, domains/URLs

Test: "if I capitalized this, would it break a real reference?" Yes → identifier, leave it. No, it's
just narrating → prose, capitalize it.

## File extensions

Use the full extension, not the shorthand: `.yaml` (not `.yml`) — including GitHub composite actions
(`action.yaml`), even though GitHub scaffolds `action.yml`.

## Environment variable names

Spell the vendor prefix out: `GITHUB_`, `CLOUDFLARE_`, `DIGITALOCEAN_` — never the short form
(`GH_`, `CF_`, `DO_`). Spelled-out names are unambiguous and greppable; abbreviations collide across
vendors and read as noise to anyone who doesn't already know the shorthand.

Exception: keep the abbreviated name when an external tool reads it verbatim and renaming would
break the integration — `GH_TOKEN`/`GH_PAGER` (gh CLI), `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`
(S3 SDK against Spaces), `secrets.GITHUB_TOKEN` (GitHub-injected). The test is the same as the
identifier carve-out: if renaming breaks a real reference, keep it.
