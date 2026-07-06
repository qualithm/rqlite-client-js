---
description: "Where to find project status, decisions, and in-flight work"
applyTo: "**"
---

# Project Context

The board and Discussions are the system of record for project state; this file maps you to them.
Consult them before reasoning about progress, in-flight work, or the decisions new work builds on.
Commands below are described by policy only — run `dx <cmd> --help` for flags.

## Where context lives

- **`README.md`** — what the repo is and how to use it; no plan or status.
- **Engineering board** — org GitHub Projects **#3**, the plan and live state. Work items are flat,
  pickable issues grouped by `Initiative` + `Status`, with the running snapshot in each issue's
  comments. Browse with `dx project board`; the pickup queue is `Status: Ready` with no assignee
  (`dx project items`). Issue bodies follow the work-item form (`### Why` / `### Scope / contract` /
  `### Acceptance` / `### Links`). `dx project lint` flags bodies that drift or lack an
  `Initiative`/`Size`; `dx project audit` flags state drift (`Status` vs. real issue/PR state, an
  `In progress` item unassigned or silent >14 days, a `Ready`/`Backlog` item already assigned);
  `dx project stats` rolls it up.
- **Size** — one agent's session effort: `XS` a one-file/one-command tweak; `S` a single file plus
  tests, one session; `M` a few files, one session; `L` multi-file or multi-session; `XL` too big —
  split it before pickup rather than claiming it. Set it when filing; `lint` requires it on every
  non-Done item.
- **🧭 Decisions** — org GitHub Discussions (Decisions category), the durable "why": one decision
  per post — what was chosen, why, which alternatives were rejected. List with `dx decision list`.
- **Initiatives** — the board `Initiative` field groups a cross-cutting effort; its narrative lives
  in the initiative's tracking issue. Add options only with `dx project initiative add` — editing
  the single-select by hand or via a raw `updateProjectV2Field` mutation recreates the options with
  new ids and silently clears every item's `Initiative`.

## Working the board

- **Status / what's next** — read the board (issue + its latest comment); filter by `Initiative` for
  a cross-repo effort, and `dx project mine` for your own in-flight items.
- **Before non-trivial work** — find or create the board issue first; don't let code get ahead of
  the plan. Check the pickup queue; if nothing fits, open an issue in the work-item form, add it
  with `dx project add`, and group cross-repo or multi-session efforts under an `Initiative`. Claim
  it with `dx project claim` before writing code — never start an unclaimed `Ready` item. If the
  work embodies a design choice, post a Decision (`dx decision add`) **before** implementing, not
  after.
- **New Initiative vs. reuse vs. flat issue** — default to not creating one: a single well-scoped
  issue needs none, and a small addition rides the Initiative it extends. Create one only when ~3+
  concretely-scoped issues (not placeholders) share a dependency chain or narrative distinct from
  every existing Initiative and span multiple sessions. Keep a lone deferred idea inside the nearest
  Initiative until it grows that much real scope.
- **Before changing settled design** — search 🧭 Decisions first; a decision records the
  alternatives already rejected, so you don't relitigate them. To reverse or narrow one,
  `dx decision amend` on the original discussion rather than opening a competing one — the original
  stays as the record, the amendment says what changed.
- **End every session** (code or planning-only) — set `Status` (`dx project status`) and post a
  Snapshot (`dx project snapshot`, which owns the format — don't hand-write it). Give every idea
  worth keeping a durable home before you close out: a Decision (the "why") or a Backlog issue (the
  "what"), never just a mention in another issue's `Links` or a chat reply — a thin placeholder now
  beats "next time". Post a whole-initiative heartbeat with `dx project update --state`.
- **Memory is not the record** — the agent memory log is a private scratch mirror, invisible to
  other sessions, agents, and humans. Anything the next picker-up needs belongs on the board or in
  Discussions; memory may echo it, never own it.

## Branching model

- **Core branches** — `development` (integration, direct pushes) → `test` (staging) → `main`
  (release). Promotion is one-way and adjacent-hop only: `test` PRs come from `development`, `main`
  PRs from `test`. Open or refresh promotion PRs with `dx git merge`. Never skip a hop or run the
  chain backwards — three-branch repos enforce this with a required `Source Branch` check.
  Single-`main` repos (`ui`, `dx`, the `*-example` templates) have no chain, but still route
  issue-resolving work through a feature-branch PR into `main`, never a direct push.
- **Feature branches** — cut from `development` (or `main` for single-branch repos), `kebab-case`,
  PR'd back into `development` (never `test`/`main` directly) with `dx git feature`. Delete the
  branch (local and remote) as soon as its PR merges — check the PR's merge state
  (`gh pr list --state all --head <branch>`), not tree ancestry, since PRs squash-merge. An unmerged
  branch idle ~2 weeks is stale: resume it, or close the PR and delete it.
- **Issue-resolving PRs** — a branch that resolves a board issue lands via a `Closes #N` PR into the
  repo's **default branch**, which auto-closes the issue and populates its GitHub **Development**
  link (the durable issue→code trail). Only a closing keyword makes that link; intermediate
  promotion hops carry `Refs #N` (no close, no link), and the `Closes #N` lands on the
  default-branch hop. `dx git feature`/`dx git merge` harvest these trailers — see
  `pr.instructions.md` and `commit.instructions.md`.
- **Worktrees** — when more than one task is in flight, prefer
  `git worktree add ../<repo>-<branch> <branch>` over switching branches in the primary clone, so
  the primary checkout stays on `development` and background tooling isn't disrupted.
