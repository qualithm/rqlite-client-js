---
description: "Where to find project status, decisions, and in-flight work"
applyTo: "**"
---

# Project Context

Before reasoning about _what is going on_ with this project — its progress, in-flight work, and the
decisions future work builds on — consult these sources. They are the system of record; this file is
only the map to them.

## Where context lives

- **`README.md`** (this repo) — _what_ it is and _how_ to use it. No plan or status.
- **Engineering board** (org GitHub Projects **#3**) — _the plan and live state_. Every work item is
  a flat, pickable issue grouped by `Initiative` + `Status`; the **running snapshot lives in the
  issue's comments**. Inspect with `dx project board 3` (filter `--initiative <name>`). The pickup
  queue is `Status: Ready, no assignee`; claim by self-assigning + setting `In progress` (one at a
  time). Issue bodies follow the work-item form (`### Why` / `### Scope / contract` /
  `### Acceptance` / `### Links`); `dx project lint` flags any that drift from it.
- **🧭 Decisions** (org GitHub Discussions, Decisions category) — _why_: durable architecture
  decisions, one per post — what was chosen, why, alternatives rejected. List recent ones with
  `dx decision list`.
- **Initiatives** — a board `Initiative` value groups a cross-cutting effort; its narrative lives in
  the initiative's tracking issue (filter `dx project board 3 --initiative <name>`). Add a new
  initiative with `dx project initiative add "<name>"` — never edit the single-select field by hand
  or via a raw `updateProjectV2Field` mutation, which recreates the options with new ids and
  silently clears the `Initiative` value on every existing item.

## How to use it

- **"What's the status / what's next?"** → the board (issue + its latest comment); for a cross-repo
  effort, filter by its `Initiative`.
- **Before changing settled design** → search 🧭 Decisions for the relevant decision; it records the
  alternatives already rejected, so you don't relitigate them.
- **End each session** → update the issue: set `Status` and post a Snapshot comment. Always post it
  with
  `dx project snapshot <issue> --repo <owner/name> --done … --in-progress … --next … --blockers …`
  (each flag repeatable) — the command owns the exact format, so don't hand-write the comment.
  Omitted sections render `- none`. When a decision crystallizes, post it with
  `dx decision add --title … --body-file …` (or `--status/--context/--decision/--consequences …`) —
  the command owns the canonical form, and `dx decision lint` flags any that drift from it.
- **Link, don't duplicate.** The agent-only memory log is a scratch mirror, not the system of record
  — promote durable facts to the board (state) or Discussions (why).
