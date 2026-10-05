# AGENTS.md

A portable summary for agents that don't load `.claude/rules/`; those files are the full contract.

- **Checks** — run `.claude/rules/checks.md` before committing; it matches CI.
- **Commits** — Conventional Commit header only: `type(scope)!: subject`, imperative, lowercase, no
  trailing period. `Refs: qualithm/pm#N` for progress, `Closes:` only when the commit completes the
  issue. No agent-attribution trailers. Never restate internal content.
- **Branches and PRs** — cut a kebab-case branch from `development` (or `main` in single-branch
  repos) and open its PR with `dx git feature`; never push to or PR into `test`/`main` directly.
  Delete the branch once its PR merges.
- **Code** — `.claude/rules/code.md`.
- **Skills** — `.claude/skills/` holds review, security and content guidance; the workspace
  `CLAUDE.md` one directory up holds the board workflow and Strategy.
