---
applyTo: "**/COMMIT_EDITMSG"
description: "Guidelines for writing commit messages"
---

# Commit Guidelines

**Default: Generate a single-line commit message (header only). Include body/footer only when
explicitly requested.**

## Format

```
type(scope)!: subject
```

- **type**: `feat` | `fix` | `docs` | `style` | `refactor` | `perf` | `test` | `build` | `ci` |
  `chore` | `revert`
- **scope**: _(optional)_ area affected, e.g. `parser`, `ui`
- **!**: _(optional)_ indicates a breaking change
- **subject**: imperative, lowercase, no trailing period

**Example**

```
feat(parser): add async function support
```

---

## Body (Optional)

- Leave one blank line after the header.
- Explain **what** and **why**, not **how**.

**Example**

```
feat(api): support user sessions

Add session middleware for persistent login.
Improves UX for returning users.
```

---

## Footer (Optional)

- Use for metadata, breaking changes, or issue references.
  - `BREAKING CHANGE:` short description of the change
  - `Closes/Fixes/Refs:` issue references (e.g. `Closes #123`)

**Board issues:** when a commit advances an engineering-board issue, add a `Refs: #N` trailer (one
issue per line for several). The `git-merge` promotion script harvests these from the promoted
commit range and self-documents the promotion PRs — as `Closes #N` on the hop into the default
branch (so the issue auto-closes on release) and `Refs #N` on intermediate hops. Use `Closes: #N` in
the commit itself only when merging that commit directly should close the issue.

**Example**

```
fix(ui)!: prevent crash on null avatar

BREAKING CHANGE: Avatar component prop "img" renamed to "src".
Closes #456
```

---

## Reverts

Use the `revert` type with the original header in quotes in the body. Include the SHA of the
reverted commit.

**Example**

```
revert: feat(api): add beta endpoints

Reverts commit 1a2b3c4.
```

---

## Release Guidance

`feat` → minor | `fix`/`perf` → patch | `BREAKING CHANGE`/`!` → major
