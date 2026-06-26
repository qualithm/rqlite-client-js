---
updated: YYYY-MM-DD
---

# Handoff

> The live working state for a fresh contributor or agent: **what's done, what's in progress, and
> exactly where to start.** Keep it SMALL and current — replace the snapshot at the end of each
> working session. Completed-work history → `CHANGELOG.md`; the forward plan → the board; the
> durable _why_ → `CONTEXT.md`. This file is only the present moment.

## Snapshot (YYYY-MM-DD)

- **Branch:** <branch> — state vs `origin`, clean/dirty working tree.
- **Done:** <one line on where things broadly stand> (details in `CHANGELOG.md`).
- **In progress:** <the thing currently being built>.
- **Next step:** <the single most concrete next action> ← start here.
- **Blockers / watch-outs:** <anything that will bite the next person>.

## Maintaining this file

Replace the snapshot each session — don't append. When a chunk of work completes, move its notes to
`CHANGELOG.md` and trim this back to the new present. If it grows past a screen, it's holding
history (→ `CHANGELOG.md`) or plan (→ the board) that doesn't belong here.
