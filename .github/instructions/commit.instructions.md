---
applyTo: "**"
description: "Guidelines for writing commit messages"
---

# Commit Guidelines

These rules apply to every commit however it is written — `git commit -m` in a terminal included,
not just an editor session on `COMMIT_EDITMSG`.

**Default: Generate a single-line commit message (header only). Include body/footer only when
explicitly requested.**

## Format

```
type(scope)!: subject
```

- **type**: `feat` | `fix` | `docs` | `style` | `refactor` | `perf` | `test` | `build` | `ci` |
  `chore` | `revert`
- **scope**: _(optional)_ area affected, e.g. `parser`, `auth`
- **!**: _(optional)_ indicates a breaking change
- **subject**: imperative, lowercase, no trailing period

**Scope discipline:** scope names the affected module, package, or area — never the action being
taken. Don't use the commit's own type/verb as its scope (e.g. `commit`, `chore`, `fix`, `update`,
`misc`). If nothing more specific applies, omit the scope entirely rather than inventing one.

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
- Do **not** add `Co-authored-by` trailers or any other Copilot/agent authorship attribution.

**Example**

```
fix(auth)!: reject tokens signed with the old key

BREAKING CHANGE: tokens issued before the key rotation are no longer accepted.
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
