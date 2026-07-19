---
description: "Rules for writing pull request titles and descriptions"
---

# Pull Request Guidelines

The title and body follow the exact same rules `dx git merge` uses to synthesize its automated
promotion PRs (see `synthesize_pr` in [scripts/git-merge](../../scripts/git-merge)) — so a PR looks
the same whether a human opens it or the promotion script does.

**Opening a feature-branch PR (not a promotion hop)?** Use `dx git feature` (scripts/git-feature)
instead of hand-writing the title/body — it pushes the current branch and creates or refreshes its
PR into `--base` (default `development`) applying these exact rules, including the harvested
`Closes`/`Refs` footer. It refuses to guess a title once a branch carries more than one commit (pass
`--title`) since summarizing intent across commits needs judgement a script doesn't have; run with
`--dry-run` to preview the title/body before pushing anything.

## Title

- If the PR carries exactly **one commit**, reuse that commit's header verbatim as the PR title (it
  already follows the Conventional Commit format from `commit.instructions.md`).
- Otherwise: for a branch-promotion PR use `Promote <from> → <to> (<N> commits)`; for any other
  multi-commit PR, write a concise imperative summary of the change — same tone and casing as a
  commit subject (lowercase, no trailing period).

## Body

```
<one-line summary of what the PR does> (<N> commit<s>).

- <commit 1 subject>
- <commit 2 subject>
...

Closes #123
Refs #456
```

- **First line:** one sentence describing what's being merged and how many commits it carries.
- **Blank line, then one bullet per commit** in the range being merged (oldest first) — its subject
  line, verbatim.
- **Blank line, then harvested issue references** — one per line:
  - Scan every commit subject/body in the range for `Close[sd]?`, `Fix(e[sd])?`, `Resolve[sd]?`, or
    `Refs?` (case-insensitive, with or without a trailing colon) followed by `#123` or
    `owner/repo#123`. De-duplicate, first-seen order.
  - **The trailer keyword is preserved, never upgraded.** A reference becomes `Closes #N` only when
    it was written with a closing keyword (`Closes`/`Fixes`/`Resolves`) somewhere in the range AND
    the PR's base is the repo's default branch (so the issue auto-closes on merge). A deliberate
    `Refs #N` stays `Refs #N` on every base branch — including the default — so partial-progress
    work referenced with `Refs` is never auto-closed. Use `Refs` (not a closing keyword) whenever a
    commit only advances an issue without completing it.
  - Every reference emits as `Refs #N` on a base branch that is not the repo's default branch, so
    the reference is visible without prematurely closing anything.
- Omit the references block entirely if no issues were referenced in the range. </content>
