#!/usr/bin/env python3
"""Run the `run:` steps of named jobs in .github/workflows/ci.yaml, as CI writes them.

Synced by `dx chat sync` from dx/chat-templates/checks/; change the template, not this file.

Usage: python3 .claude/checks/ci-jobs.py [--all] [--base REF] [--skip-ci-only] JOB...

A step that names helm/<chart> runs only for the charts changed since the merge
base with REF (default origin/development), uncommitted and untracked files
included. --all, a changed ci.yaml, or no merge base checks every chart. Steps
with `uses:` and steps named "Install ..." are skipped, so their tools must
already be installed. A step using a GitHub expression can only run in CI: it
stops the run, unless --skip-ci-only skips it instead (for jobs whose
expression steps only report, like a Codecov upload). Every selected step runs;
the exit status is 1 when any failed.
"""

import argparse
import os
import re
import subprocess
import sys

import yaml

WORKFLOW = ".github/workflows/ci.yaml"
SELF = ".claude/checks/ci-jobs.py"
CHART = re.compile(r"\bhelm/([A-Za-z0-9._-]+)")
CHART_PATH = re.compile(r"^helm/([^/]+)/")


def git(*args):
    result = subprocess.run(["git", *args], capture_output=True, text=True)
    return result.stdout if result.returncode == 0 else None


def changed_charts(base):
    """The charts changed since the merge base with base, or None for every chart."""
    merge_base = git("merge-base", "HEAD", base)
    if merge_base is None:
        print(f"ci-jobs: no merge base with {base}; checking every chart", file=sys.stderr)
        return None
    diff = git("diff", "--name-only", merge_base.strip())
    untracked = git("ls-files", "--others", "--exclude-standard")
    if diff is None or untracked is None:
        return None
    paths = set(diff.splitlines()) | set(untracked.splitlines())
    if WORKFLOW in paths or SELF in paths:
        return None
    return {match.group(1) for path in paths if (match := CHART_PATH.match(path))}


def scoped(run, charts):
    """The step's command limited to the changed charts, or None to skip it."""
    named = set(CHART.findall(run))
    if charts is None or not named:
        return run
    keep = named & charts
    if not keep:
        return None
    if keep == named:
        return run
    # A step naming several charts takes them as arguments: drop the unchanged ones.
    flat = run.replace("\\\n", " ")
    for chart in named - keep:
        flat = re.sub(rf"\s+helm/{re.escape(chart)}(?=\s|$)", "", flat)
    return flat


def main():
    parser = argparse.ArgumentParser(description="run ci.yaml jobs locally")
    parser.add_argument("jobs", nargs="+", metavar="JOB")
    parser.add_argument("--all", action="store_true", help="check every chart")
    parser.add_argument("--base", default="origin/development", help="ref to diff against")
    parser.add_argument(
        "--skip-ci-only",
        action="store_true",
        help="skip steps that use a GitHub expression instead of stopping",
    )
    args = parser.parse_args()

    with open(WORKFLOW, encoding="utf-8") as file:
        jobs = (yaml.safe_load(file) or {}).get("jobs") or {}
    charts = None if args.all else changed_charts(args.base)
    if charts is not None and not charts:
        print(f"ci-jobs: no chart changed since {args.base}; skipping chart steps", file=sys.stderr)

    failed = []
    for name in args.jobs:
        if name not in jobs:
            sys.exit(f"ci-jobs: {WORKFLOW} has no job {name}")
        for step in jobs[name].get("steps") or []:
            run = step.get("run")
            title = str(step.get("name") or "")
            if run is None or title.startswith("Install "):
                continue
            label = f"{name}: {title or run.strip().splitlines()[0]}"
            env = {key: str(value) for key, value in (step.get("env") or {}).items()}
            if "if" in step or "${{" in run or any("${{" in value for value in env.values()):
                if args.skip_ci_only:
                    print(f"--- {label}: skipped (runs only in CI)", file=sys.stderr)
                    continue
                sys.exit(f"ci-jobs: {label}: uses a GitHub expression, so it runs only in CI")
            command = scoped(run, charts)
            if command is None:
                continue
            print(f"==> {label}", flush=True)
            result = subprocess.run(
                ["bash", "--noprofile", "--norc", "-eo", "pipefail", "-c", command],
                cwd=step.get("working-directory", "."),
                env={**os.environ, **env},
            )
            if result.returncode != 0:
                failed.append(label)

    if failed:
        print("ci-jobs: failed:\n  " + "\n  ".join(failed), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
