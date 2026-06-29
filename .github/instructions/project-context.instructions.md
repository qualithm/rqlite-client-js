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
- **Engineering board** (org GitHub Projects **#3**) — _the plan and live state_. Every work item is a
  flat, pickable issue grouped by `Initiative` + `Status`; the **running snapshot lives in the
  issue's comments**. Inspect with `dx project board 3` (filter `--initiative <name>`). The pickup
  queue is `Status: Ready, no assignee`; claim by self-assigning + setting `In progress` (one at a
  time).
- **🧭 Decisions** (org GitHub Discussions, Decisions category) — _why_: durable architecture
  decisions (ADRs), one per post — what was chosen, why, alternatives rejected.
- **Cross-cutting initiatives** — `dx/initiatives/<name>.md` (start at `index.md`): efforts spanning
  repos, linking the board and Discussions.

## How to use it

- **"What's the status / what's next?"** → the board (issue + its latest comment); for a cross-repo
  effort, `dx/initiatives/<x>.md`.
- **Before changing settled design** → search 🧭 Decisions for the relevant ADR; it records the
  alternatives already rejected, so you don't relitigate them.
- **End each session** → update the issue: set `Status` and post a
  `**Snapshot** — Done / In progress / Next / Blockers` comment. When a decision crystallizes, open
  a Decisions discussion.
- **Link, don't duplicate.** The agent-only memory log is a scratch mirror, not the system of record
  — promote durable facts to the board (state) or Discussions (why).
