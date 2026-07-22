#!/usr/bin/env bash
# Vendored by dx/scripts/audit-sync from dx's .github/actions/report-scan-failure/run.sh. Do not edit directly — change the source in dx and re-run audit-sync.
# Implementation for the report-scan-failure composite action. See action.yaml for inputs.
set -euo pipefail

: "${REPO:?}" "${MODE:?}" "${TITLE:?}"

# Labels to apply and dedup under; accept space- or comma-separated input.
LABELS="${LABELS:-security-audit}"
LABELS="${LABELS//,/ }"

existing="$(gh issue list --repo "$REPO" --state open --search "\"${TITLE}\"" \
  --json number,title --jq "[.[] | select(.title == \"${TITLE}\")][0].number // empty")"

case "$MODE" in
report)
  # Ensure every requested label exists before `gh issue create --label` can
  # attach it. `security-audit` and `off-board` are the off-the-Engineering-board
  # markers (issue-templates/add-to-project.yaml excludes both) and keep their
  # canonical styling; see Decision #66:
  # https://github.com/orgs/qualithm/discussions/66. Any other label is created
  # if missing with a neutral colour. --force makes the marker creates idempotent.
  for l in $LABELS; do
    case "$l" in
    security-audit)
      gh label create security-audit --repo "$REPO" --color "b60205" --force \
        --description "Automated scan failure filed by report-scan-failure; kept off the Engineering board (Decision #66)" \
        >/dev/null
      ;;
    off-board)
      gh label create off-board --repo "$REPO" --color "5319e7" --force \
        --description "Automation-filed issue kept off the Engineering board (Decision #66)" \
        >/dev/null
      ;;
    *)
      gh label create "$l" --repo "$REPO" --color "ededed" >/dev/null 2>&1 || true
      ;;
    esac
  done

  label_args=()
  for l in $LABELS; do label_args+=(--label "$l"); done

  if [[ -n "$existing" ]]; then
    gh issue comment "$existing" --repo "$REPO" --body "Still failing as of ${RUN_URL}."
    echo "report-scan-failure: bumped existing issue #${existing}"
  else
    body="${BODY:-}"
    if [[ -z "$body" ]]; then
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
    fi
    url="$(gh issue create --repo "$REPO" --title "$TITLE" --body "$body" "${label_args[@]}")"
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
