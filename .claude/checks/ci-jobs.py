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
expression steps only report, like a Codecov upload). What a step writes to
$GITHUB_ENV or $GITHUB_PATH reaches the job's later steps. As in Actions, a
failed step skips the rest of its job; every selected job runs, and the exit
status is 1 when any failed.
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile

try:
    import yaml
except ImportError:
    # Stock macOS python3 has no PyYAML. Rerun under uv, which supplies it.
    if os.environ.get("CI_JOBS_UV") is None and shutil.which("uv") is not None:
        os.environ["CI_JOBS_UV"] = "1"
        sys.exit(
            subprocess.run(
                ["uv", "run", "--no-project", "--with", "pyyaml==6.0.3", "python3", *sys.argv]
            ).returncode
        )
    sys.exit("ci-jobs: needs PyYAML; install uv (https://docs.astral.sh/uv/) or run `pip install pyyaml`")

# macOS blocks a headless process from ~/Documents without a prompt, so
# arduino-cli's default sketchbook there hangs it. Keep it in its data folder.
if sys.platform == "darwin":
    os.environ.setdefault(
        "ARDUINO_DIRECTORIES_USER", os.path.expanduser("~/Library/Arduino15/user")
    )

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


def read_lines(path):
    with open(path, encoding="utf-8") as file:
        return [line.strip() for line in file if line.strip()]


def read_env_file(path):
    """The variables a step wrote to $GITHUB_ENV: NAME=value, or NAME<<DELIMITER blocks."""
    values = {}
    with open(path, encoding="utf-8") as file:
        lines = file.read().splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if "<<" in line and ("=" not in line or line.index("<<") < line.index("=")):
            key, delimiter = line.split("<<", 1)
            end = lines.index(delimiter, i + 1)
            values[key] = "\n".join(lines[i + 1 : end])
            i = end + 1
            continue
        if "=" in line:
            key, value = line.split("=", 1)
            values[key] = value
        i += 1
    return values


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
        workflow = yaml.safe_load(file) or {}
    jobs = workflow.get("jobs") or {}
    charts = None if args.all else changed_charts(args.base)
    if charts is not None and not charts:
        print(f"ci-jobs: no chart changed since {args.base}; skipping chart steps", file=sys.stderr)

    failed = []
    runner_temp = tempfile.mkdtemp(prefix="ci-jobs-")
    for name in args.jobs:
        if name not in jobs:
            sys.exit(f"ci-jobs: {WORKFLOW} has no job {name}")
        github_env = os.path.join(runner_temp, f"{name}.env")
        github_path = os.path.join(runner_temp, f"{name}.path")
        for file in (github_env, github_path):
            open(file, "w", encoding="utf-8").close()
        for step in jobs[name].get("steps") or []:
            run = step.get("run")
            title = str(step.get("name") or "")
            if run is None or title.startswith("Install "):
                continue
            label = f"{name}: {title or run.strip().splitlines()[0]}"
            # Workflow, then job, then step env, as Actions layers them. A
            # workflow or job value that needs an expression is left out; a
            # step's stops the step below.
            inherited = {
                key: str(value)
                for scope in (workflow, jobs[name])
                for key, value in (scope.get("env") or {}).items()
                if "${{" not in str(value)
            }
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
            exported = read_env_file(github_env)
            paths = read_lines(github_path)
            base = {**os.environ, "RUNNER_TEMP": runner_temp, **inherited, **exported, **env}
            if paths:
                base["PATH"] = os.pathsep.join([*reversed(paths), base.get("PATH", "")])
            result = subprocess.run(
                ["bash", "--noprofile", "--norc", "-eo", "pipefail", "-c", command],
                cwd=step.get("working-directory", "."),
                env={**base, "GITHUB_ENV": github_env, "GITHUB_PATH": github_path},
            )
            if result.returncode != 0:
                failed.append(label)
                print(f"--- {name}: skipping its remaining steps", file=sys.stderr)
                break

    if failed:
        print("ci-jobs: failed:\n  " + "\n  ".join(failed), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
