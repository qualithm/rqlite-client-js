#!/usr/bin/env bash
# Refresh a pull request's title/body from its live commit range, using the
# vendored git-pr-synthesize sibling. Vendored into every enrolled repo by
# dx/scripts/pr-sync — do not edit a repo's copy; change pr-templates/
# refresh.sh here and re-run `dx pr sync`. (dx#317)
#
# Usage: refresh.sh <base-branch> <pr-number>
#
# Requires: gh (GH_TOKEN in env with pull-requests: write), zsh, python3.
set -euo pipefail

base="$1"
pr="$2"
dir="$(cd "$(dirname "$0")" && pwd)"

out=$(mktemp)
rc=0
"$dir/git-pr-synthesize" --repo-dir "$GITHUB_WORKSPACE" --base "$base" --json > "$out" || rc=$?
if [[ "$rc" -eq 3 ]]; then
  # Multi-commit PR: the title can't be inferred mechanically — reuse the
  # PR's current title and refresh the body only.
  title=$(gh pr view "$pr" --json title --jq .title)
  "$dir/git-pr-synthesize" --repo-dir "$GITHUB_WORKSPACE" --base "$base" --title "$title" --json > "$out"
elif [[ "$rc" -ne 0 ]]; then
  exit "$rc"
fi

title_file=$(mktemp)
body_file=$(mktemp)
OUT="$out" TITLE_FILE="$title_file" BODY_FILE="$body_file" python3 - <<'PY'
import json
import os

with open(os.environ["OUT"]) as f:
    d = json.load(f)
with open(os.environ["TITLE_FILE"], "w") as f:
    f.write(d["title"])
with open(os.environ["BODY_FILE"], "w") as f:
    f.write(d["body"])
PY

title="$(cat "$title_file")"
cur_title=$(gh pr view "$pr" --json title --jq .title)
cur_body=$(gh pr view "$pr" --json body --jq .body)

# Skip the edit when nothing changed, so a push that doesn't alter the range's
# synthesis (e.g. a rebase onto an updated base) doesn't fire a spurious
# `edited` event. --jq prints without a trailing newline; normalize the
# synthesized body the same way before comparing.
if [[ "$title" == "$cur_title" && "$(printf '%s' "$(cat "$body_file")")" == "$cur_body" ]]; then
  echo "PR #$pr title/body already current — nothing to do"
  exit 0
fi

gh pr edit "$pr" --title "$title" --body-file "$body_file"
echo "PR #$pr title/body refreshed from origin/$base..HEAD"
