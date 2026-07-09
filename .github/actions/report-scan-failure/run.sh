#!/usr/bin/env bash
# Vendored by dx/scripts/audit-sync from dx's .github/actions/report-scan-failure/run.sh. Do not edit directly — change the source in dx and re-run audit-sync.
# Implementation for the report-scan-failure composite action. See action.yaml for inputs.
set -euo pipefail

: "${REPO:?}" "${MODE:?}" "${TITLE:?}"

existing="$(gh issue list --repo "$REPO" --state open --search "\"${TITLE}\"" \
  --json number,title --jq "[.[] | select(.title == \"${TITLE}\")][0].number // empty")"

case "$MODE" in
report)
  # security-audit deliberately keeps these off the Engineering board (issue-templates/
  # add-to-project.yaml excludes it) — see Decision #66:
  # https://github.com/orgs/qualithm/discussions/66. The label must exist before `gh issue
  # create --label` can attach it, so ensure it every run; --force makes this idempotent.
  gh label create security-audit --repo "$REPO" --color "b60205" --force \
    --description "Automated scan failure filed by report-scan-failure; kept off the Engineering board (Decision #66)" \
    >/dev/null

  if [[ -n "$existing" ]]; then
    gh issue comment "$existing" --repo "$REPO" --body "Still failing as of ${RUN_URL}."
    echo "report-scan-failure: bumped existing issue #${existing}"
  else
    body="### Why
The scheduled scan is failing, which means it found something real rather than a one-off flake
— someone needs to look at the failing run and fix the underlying problem.

### Scope / contract
Investigate the failing run linked below, determine the root cause, and resolve it (dependency
bump, code fix, or a documented, justified suppression). Do not silence the check without
addressing the finding.

### Acceptance
- [ ] Root cause identified
- [ ] Fix applied
- [ ] The workflow passes again on this repo

### Links
- Failing run: ${RUN_URL}"
    url="$(gh issue create --repo "$REPO" --title "$TITLE" --body "$body" --label security-audit)"
    echo "report-scan-failure: filed ${url}"
  fi
  ;;
resolve)
  if [[ -n "$existing" ]]; then
    assignees="$(gh issue view "$existing" --repo "$REPO" --json assignees --jq '.assignees | length')"
    if [[ "$assignees" -eq 0 ]]; then
      gh issue comment "$existing" --repo "$REPO" \
        --body "Resolved automatically — the workflow passed again with nobody assigned."
      gh issue close "$existing" --repo "$REPO"
      echo "report-scan-failure: auto-closed issue #${existing}"
    else
      echo "report-scan-failure: issue #${existing} is claimed; leaving it for whoever is fixing it"
    fi
  else
    echo "report-scan-failure: no open issue to resolve"
  fi
  ;;
*)
  echo "report-scan-failure: unknown mode: ${MODE}" >&2
  exit 1
  ;;
esac
