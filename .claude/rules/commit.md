---
description: "Guidelines for writing commit messages"
---

# Commit Guidelines

These apply to every commit, `git commit -m` included. Write the header only unless a body is asked
for.

```
type(scope)!: subject
```

- **type**: `feat` | `fix` | `docs` | `style` | `refactor` | `perf` | `test` | `build` | `ci` |
  `chore` | `revert`
- **scope** _(optional)_: the affected module, package, or area — never the action (`commit`, `fix`,
  `update`, `misc`). Omit it rather than invent one.
- **!** _(optional)_: a breaking change; add a `BREAKING CHANGE: <what broke>` footer.
- **subject**: imperative, lowercase, no trailing period.

A body, when asked for, follows a blank line and explains what and why, not how. A revert uses the
`revert` type with the original header as its subject and `Reverts commit <sha>.` in the body.

## Footer

- **Board issues** use the cross-repo form, one per line: `Refs: qualithm/pm#N` for progress,
  `Closes: qualithm/pm#N` (or `Fixes:`/`Resolves:`) only when the commit completes the issue. The
  keyword is never upgraded, so a `Refs` never auto-closes anything.
- Never add `Co-authored-by` or any other agent-attribution trailer.

**Never restate internal content.** Reference the issue; never repeat its reasoning, the names of
private repos or services, or a Decision's content. Commit history is permanent and public repos
expose it.
