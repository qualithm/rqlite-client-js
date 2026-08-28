# AGENTS.md

Guidance for any agent working in this repository. The `.github/instructions/` files are the full
contract — this file is the portable summary for agents that don't read VS Code instruction files.

## Before committing

Run the pre-commit checks in `.github/instructions/checks.instructions.md` — they match CI exactly,
so a local pass means CI passes.

## Commits

Conventional Commits, header only unless asked for a body: `type(scope)!: subject` — imperative,
lowercase, no trailing period. Never add `Co-authored-by` or agent-attribution trailers. Full rules:
`.github/instructions/commit.instructions.md`.

## Pull requests

Title = the Conventional Commit header of the change. One PR per branch, into the repo's default
branch — never a direct push. Full rules: `.github/instructions/pr.instructions.md`.

## Branches

Cut from the repo's integration branch (`development`, or `main` in single-branch repos),
kebab-case, PR back to the same branch. Delete the branch once its PR merges. The promotion chain
(`development` → `test` → `main`) is one-way; never PR into `test` or `main` directly.

## Everything else

- Code conventions for this stack: `.github/copilot-instructions.md`
- Review and security guidance: `.github/review.md`, `.github/security.md`
