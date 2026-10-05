---
description: "Rules for pull request titles and descriptions"
---

# Pull Request Guidelines

- **Open feature PRs with `dx git feature`** (`--dry-run` first). It pushes the branch and writes
  the title, body and `Closes`/`Refs` footer from the commits; the `refresh-pr.yaml` workflow
  rewrites the body on every push. Never hand-edit the body — review notes go in comments.
- **Title** is a Conventional Commit header (`.claude/rules/commit.md`): a single-commit branch
  reuses the commit's subject, so fix it with `git commit --amend`. A multi-commit branch needs
  `--title`, which becomes the squash commit's subject.
- **One issue-resolving PR per branch**, into the repo's default branch. Promotion PRs come from
  `dx git merge`, never by hand.
- **Never restate internal content.** The title, body and review comments reference the issue; they
  never repeat its reasoning, private repo or service names, or a Decision's content.
