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
- **Before starting non-trivial work** → find or create the board issue first; don't let code get
  ahead of the plan. Check `dx project board 3` (filter `--initiative <name>`) for an existing
  pickable issue. If none exists, open one following the work-item form (`### Why` /
  `### Scope / contract` / `### Acceptance` / `### Links`) and add it with
  `dx project add 3 --url <issue-url>`. Group cross-repo or multi-step efforts under an `Initiative`
  — `dx project initiative add "<name>"` if it doesn't exist yet. Self-assign and set
  `Status: In progress` before writing code; never start against `Status: Ready, no assignee`
  without claiming it. If the work embodies a design choice rather than an obvious continuation,
  post it with `dx decision add` **before** implementing — the rationale should precede the code,
  not document it after the fact.
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

## Branching model

- **Core branches** — `development` (integration, direct pushes) → `test` (staging) → `main`
  (release). Promotion is one-way and **adjacent-hop only**: a PR into `test` must come from
  `development`; a PR into `main` must come from `test`. Never open a PR that skips a hop
  (`development` straight into `main`) or runs the chain backwards — repos with all three branches
  enforce this with a required `Source Branch` status check, not just convention. Repos with only a
  `main` branch (`ui`, `dx`, the `*-example` templates) push directly to `main`; there's no chain to
  reason about.
- **Feature branches** — cut from `development` (or `main` for single-branch repos), named for the
  work in `kebab-case`. PR them back into `development` — not `test` or `main` directly — so the
  change rides the normal promotion chain instead of bypassing it. Once its PR merges, delete the
  branch (local **and** remote); a merged branch has no reason to linger, and `git branch --merged`
  understates what's safe to delete here since PRs squash-merge — check the PR's merge state
  (`gh pr list --state all --head <branch>`), not just tree/ancestry, before deleting.
- **Worktrees** — prefer `git worktree add ../<repo>-<branch> <branch>` over switching branches in
  the primary clone when more than one thing is in flight (e.g. a feature alongside an urgent fix).
  This keeps the primary checkout on `development` so other tooling (dev servers, background syncs)
  isn't disrupted by a branch switch, and lets parallel efforts progress without stashing.
