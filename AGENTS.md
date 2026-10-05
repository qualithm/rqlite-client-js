# AGENTS.md

Guidance for any agent working in this repository. The `.claude/rules/` files are the full contract
— Claude Code loads them automatically; this file is the portable summary for agents that don't.

## Before committing

Run the pre-commit checks in `.claude/rules/checks.md` — they match CI exactly, so a local pass
means CI passes.

## Commits

Conventional Commits, header only unless asked for a body: `type(scope)!: subject` — imperative,
lowercase, no trailing period. Never add `Co-authored-by` or agent-attribution trailers. When the
commit advances a board issue, add a `Refs: qualithm/pm#N` trailer; use `Closes:`/`Fixes:` only when
the commit genuinely completes the issue. Reference an issue; never restate its contents, private
repo or service names, or Decision content. Full rules: `.claude/rules/commit.md`.

## Pull requests

Title = the Conventional Commit header of the change. One issue-resolving PR per branch, into the
repo's default branch — never a direct push. Full rules: `.claude/rules/pr.md`.

## Branches

Cut from the repo's integration branch (`development`, or `main` in single-branch repos),
kebab-case, PR back to the same branch. Delete the branch once its PR merges. The promotion chain
(`development` → `test` → `main`) is one-way; never PR into `test` or `main` directly.

## Everything else

- Project state, the board, and how to claim work: the workspace `CLAUDE.md` one directory up, which
  `dx chat sync` writes
- Code conventions for this stack: `.claude/rules/code.md`
- Review and security guidance: the `review-guidance` and `security-guidance` skills in
  `.claude/skills/`
