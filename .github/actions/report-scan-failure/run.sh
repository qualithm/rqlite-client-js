#!/usr/bin/env bash
# Vendored by dx/scripts/audit-sync from dx's .github/actions/report-scan-failure/run.sh. Do not edit directly — change the source in dx and re-run audit-sync.
# Implementation for the report-scan-failure composite action. See action.yaml for inputs.
set -euo pipefail

: "${REPO:?}" "${MODE:?}" "${TITLE:?}"

existing="$(gh issue list --repo "$REPO" --state open --search "\"${TITLE}\"" \
  --json number,title --jq "[.[] | select(.title == \"${TITLE}\")][0].number // empty")"

case "$MODE" in
report)
  if [[ -n "$existing" ]]; then
    gh issue comment "$existing" --repo "$REPO" --body "Still failing as of ${RUN_URL}."
    echo "report-scan-failure: bumped existing issue #${existing}"
  else
    body="### Why
The scheduled scan is failing, which means it found something real rather than a one-off flake —
someone needs to look at the failing run and fix the underlying problem.

### Scope / contract
Investigate ${RUN_URL}, determine the root cause, and resolve it (dependency bump, code fix, or a
documented, justified suppression). Do not silence the check without addressing the finding.

### Acceptance
- [ ] Root cause identified
- [ ] Fix applied
- [ ] The workflow passes again on this repo

### Links
- Failing run: ${RUN_URL}"
    url="$(gh issue create --repo "$REPO" --title "$TITLE" --body "$body")"
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
