---
description: "Rules for writing pull request titles and descriptions"
---

# Pull Request Guidelines

## Title

- If the PR carries exactly **one commit**, reuse that commit's header verbatim as the PR title (it
  already follows the Conventional Commit format from `commit.instructions.md`).
- Otherwise, write a `type(scope): subject` header in the Conventional Commit format from
  `commit.instructions.md` — a concise imperative summary of the change (lowercase, no trailing
  period). Feature PRs squash-merge, so this title becomes the squash commit's subject and must read
  as a valid commit.

## Body

- Lead with one sentence describing what the PR does.
- Reference any issue the PR resolves with a closing keyword (`Closes #123`) on its own line; use
  `Refs #123` for partial progress you don't want auto-closed.
- Review notes belong in comments, not the body.
