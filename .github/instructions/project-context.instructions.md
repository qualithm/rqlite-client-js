---
description: "Where to find project status, decisions, and in-flight work"
applyTo: "**"
---

# Project Context

Before reasoning about _what is going on_ with this project — its progress, in-flight work, and the
decisions future work builds on — consult these sources. They are the system of record; this file is
only the map to them.

## Where context lives

**In this repo — read these first (the triad):**

1. **`README.md`** — _what_ it is and _how_ to use it.
2. **`CONTEXT.md`** — _why_: intent, direction, load-bearing assumptions, key decisions (frontmatter
   `status`/`updated`).
3. **`HANDOFF.md`** — _now_: the live working state — what's done, what's in progress, and the
   single next step (frontmatter `updated`). **Read this to know where to start.**
4. **`docs/adr/NNNN-*.md`** — repo-local immutable decisions (frontmatter `status`/`date`/`scope`).

**Across repos — the cross-cutting plane:**

5. **Live work (what's in flight, who, when)** — the org **GitHub Projects** board. Inspect it with
   `dx project list` / `dx project board [number]` (filter with `--initiative <name>`). Items carry
   `Status`, `Initiative`, and `Estimate` fields.
6. **Cross-cutting initiatives (efforts spanning repos, phase by phase)** — markdown in the sibling
   `dx/` repo under `dx/initiatives/`. Start at `dx/initiatives/index.md`; each
   `dx/initiatives/<name>.md` has frontmatter (`status`, `repos`, `updated`). It links the
   participating repos' `HANDOFF.md` files.
7. **Cross-cutting decisions** — immutable ADRs in `dx/initiatives/adr/NNNN-*.md`.

## How to use it

- **To answer "what's the status of X?"** read its `HANDOFF.md` (live state) — and, for a cross-repo
  effort, the board + `dx/initiatives/<x>.md`.
- **Before changing an area with a settled design,** read its ADRs / `CONTEXT.md` first — they
  record the alternatives already rejected, so you don't relitigate them.
- **Keep the docs in their lanes:** README = what/how, CONTEXT = why, HANDOFF = now. Plan → the
  board; completed history → `CHANGELOG.md`; decisions → ADRs. Don't put planning or status in the
  README.
- **Update `HANDOFF.md` at the end of a working session** (replace the snapshot, don't append). When
  a decision crystallizes, record an ADR or update `CONTEXT.md`. The dense agent-only memory log is
  a scratch mirror, **not** the system of record — promote durable facts into the triad / ADRs.
- **Link, don't duplicate.**
