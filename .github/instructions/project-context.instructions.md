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
  queue is `Status: Ready, no assignee`; claim it with
  `dx project claim <issue> --repo <owner/name>` (self-assigns + sets `In progress` atomically, one
  at a time; refuses if already assigned unless `--force`). Issue bodies follow the work-item form
  (`### Why` / `### Scope / contract` / `### Acceptance` / `### Links`); `dx project lint` flags any
  that drift from it, and `dx project audit` flags any item whose `Status` disagrees with the real
  issue/PR state (e.g. marked Done but still open).
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
  — `dx project initiative add "<name>"` if it doesn't exist yet. Claim it with
  `dx project claim <issue> --repo <owner/name>` before writing code — this self-assigns and sets
  `Status: In progress` in one step; never start against `Status: Ready, no assignee` without
  claiming it. If the work embodies a design choice rather than an obvious continuation, post it
  with `dx decision add` **before** implementing — the rationale should precede the code, not
  document it after the fact.
- **When to create a new Initiative vs. reuse one vs. just file a flat issue.** Default to _not_
  creating one — a single well-scoped issue never needs its own Initiative, and a small addition to
  existing work belongs under whichever Initiative it naturally extends. Spin up a new Initiative
  once a body of work has actually earned independent tracking: roughly three or more
  concretely-scoped issues (not placeholders) sharing a dependency chain or narrative distinct from
  any existing Initiative, expected to span multiple sessions. A single placeholder issue capturing
  a deferred idea does not need its own Initiative yet — leave it inside the most related existing
  one and only split it out once the idea grows enough real, scoped issues to justify it. (This is
  how a body of billing/email planning grew Automations and Dashboards into their own Initiatives
  mid-session once they had real scope, while an automations-billing-metering thread stayed a single
  placeholder inside Billing & Usage until it did.)
- **Before changing settled design** → search 🧭 Decisions for the relevant decision; it records the
  alternatives already rejected, so you don't relitigate them. If you're reversing or narrowing one,
  record that on the original discussion with `dx decision amend --number N --summary "..."` (posts
  a `**Amendment (YYYY-MM-DD):**` comment) rather than relitigating it as a new discussion — the
  original Context/Decision/Consequences stay intact as the historical record, and the amendment
  says what changed and why.
- **End each session** → update the issue: set `Status` (`dx project status <issue-url> <value>`)
  and post a Snapshot comment. Always post it with
  `dx project snapshot <issue> --repo <owner/name> --done … --in-progress … --next … --blockers …`
  (each flag repeatable) — the command owns the exact format, so don't hand-write the comment.
  Omitted sections render `- none`. When a decision crystallizes, post it with
  `dx decision add --title … --body-file …` (or `--status/--context/--decision/--consequences …`) —
  the command owns the canonical form, and `dx decision lint` flags any that drift from it.
- **End each planning/discovery session (no code changed) the same way.** A conversation that only
  produces ideas is not done until every idea worth keeping has a durable home. Before closing out:
  audit each design thread discussed, including tangential or explicitly-deferred ones, and confirm
  it landed as either a Decision (the "why", even for work with no issue yet) or a Backlog issue
  (the "what", even if unstartable today) — not as a mention buried in another issue's `Links`
  section and not as prose in a chat reply. "We'll scope this properly next time" is fine as a
  decision; leaving the idea undocumented until "next time" is not — post a placeholder Decision or
  issue capturing the shape of it now, thin as it may be.
- **Link, don't duplicate — and memory is not a substitute for either.** The agent-only memory log
  (session or repo-scoped) is a scratch mirror for continuity within a tool's own context, not the
  system of record: it is invisible to a different session, a different agent, or a human teammate.
  If a fact would matter to whoever picks this up next, it belongs on the board or in Discussions,
  full stop — memory may additionally note it for convenience, but never _only_ note it there.

## Branching model

- **Core branches** — `development` (integration, direct pushes) → `test` (staging) → `main`
  (release). Promotion is one-way and **adjacent-hop only**: a PR into `test` must come from
  `development`; a PR into `main` must come from `test`. Run `dx git merge` (`--repos r1,r2` to
  scope it, `--wait` to poll until each hop's PR is merged before opening the next) to open or
  refresh these promotion PRs — it self-documents by harvesting `Closes`/`Refs #N` from the promoted
  commits' associated PRs (see `pr.instructions.md`); re-run it after each PR merges if not using
  `--wait`. Never open a PR that skips a hop (`development` straight into `main`) or runs the chain
  backwards — repos with all three branches enforce this with a required `Source Branch` status
  check, not just convention. Repos with only a `main` branch (`ui`, `dx`, the `*-example`
  templates) push directly to `main`; there's no chain to reason about.
- **Feature branches** — cut from `development` (or `main` for single-branch repos), named for the
  work in `kebab-case`. PR them back into `development` — not `test` or `main` directly — so the
  change rides the normal promotion chain instead of bypassing it. Open (or refresh) the PR with
  `dx git feature` (see `pr.instructions.md`) rather than hand-writing the title/body. Once its PR
  merges, delete the branch (local **and** remote) immediately; a merged branch has no reason to
  linger, and `git branch --merged` understates what's safe to delete here since PRs squash-merge —
  check the PR's merge state (`gh pr list --state all --head <branch>`), not just tree/ancestry,
  before deleting. **Unmerged** branches have no fixed TTL while active, but treat one as stale if
  its PR has had no commits or review activity for ~2 weeks — at that point either resume the work
  or close the PR and delete the branch rather than letting it rot.
- **Worktrees** — prefer `git worktree add ../<repo>-<branch> <branch>` over switching branches in
  the primary clone when more than one thing is in flight (e.g. a feature alongside an urgent fix).
  This keeps the primary checkout on `development` so other tooling (dev servers, background syncs)
  isn't disrupted by a branch switch, and lets parallel efforts progress without stashing.
