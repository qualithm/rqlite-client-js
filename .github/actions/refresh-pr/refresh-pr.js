// @bun
// Generated from dx src/actions/refreshPr.ts by `bun run build:refresh-pr`. Do not edit.
/* eslint-disable */
async function exec(argv, options = {}) {
  const child = Bun.spawn([...argv], {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdout: "pipe",
    stderr: "pipe"
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited
  ]);
  return { exitCode, stdout, stderr };
}

class DxError extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "DxError";
    this.code = code;
  }
}
function describeError(error) {
  if (error instanceof DxError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { code: "error", message: error.message };
  }
  return { code: "error", message: String(error) };
}

var API_URL = "https://api.github.com";
var MAX_ATTEMPTS = 4;
var MAX_RATE_LIMIT_WAIT_MS = 60000;
async function resolveToken(env) {
  for (const name of ["GH_TOKEN", "GITHUB_TOKEN"]) {
    const value = env[name];
    if (value !== undefined && value !== "") {
      return value;
    }
  }
  const result = await exec(["gh", "auth", "token"]).catch(() => {
    return;
  });
  const token = result?.exitCode === 0 ? result.stdout.trim() : "";
  if (token === "") {
    throw new DxError("auth", "No GitHub token: set GH_TOKEN or run gh auth login");
  }
  return token;
}
function codeForStatus(status) {
  switch (status) {
    case 401:
    case 403:
      return "auth";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 429:
      return "rate_limited";
    default:
      return "api";
  }
}
function createGitHubClient(options) {
  const fetchImpl = options.fetch ?? (async (input, init) => fetch(input, init));
  const sleep = options.sleep ?? (async (ms) => Bun.sleep(ms));
  const now = options.now ?? Date.now;
  const baseUrl = options.baseUrl ?? API_URL;
  const send = async (method, url, body, headers = {}) => {
    const init = {
      method,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${options.token}`,
        "x-github-api-version": "2022-11-28",
        ...body === undefined ? {} : { "content-type": "application/json" },
        ...headers
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    };
    for (let attempt = 1;; attempt += 1) {
      const last = attempt >= MAX_ATTEMPTS;
      let response;
      try {
        response = await fetchImpl(url, init);
      } catch (error) {
        if (last) {
          const reason = error instanceof Error ? error.message : String(error);
          throw new DxError("error", `${method} ${url}: ${reason}`);
        }
        await sleep(backoff(attempt));
        continue;
      }
      if (response.ok) {
        return response;
      }
      const wait = rateLimitWait(response, now());
      if (wait !== undefined && !last && wait <= MAX_RATE_LIMIT_WAIT_MS) {
        await sleep(wait);
        continue;
      }
      if (response.status >= 500 && !last) {
        await sleep(backoff(attempt));
        continue;
      }
      const code = wait === undefined ? codeForStatus(response.status) : "rate_limited";
      throw new DxError(code, `${method} ${url}: ${String(response.status)} ${await errorText(response)}`);
    }
  };
  const url = (path) => path.startsWith("http") ? path : `${baseUrl}/${path.replace(/^\//, "")}`;
  return {
    request: async (method, path, body, requestOptions = {}) => {
      const response = await send(method, url(path), body, requestOptions.headers);
      return response.status === 204 ? undefined : await response.json();
    },
    paginate: async (path) => {
      const items = [];
      let next = url(path);
      while (next !== undefined) {
        const response = await send("GET", next);
        items.push(...await response.json());
        next = nextLink(response.headers.get("link"));
      }
      return items;
    },
    graphql: async (query, variables = {}) => {
      const response = await send("POST", url("graphql"), { query, variables });
      const payload = await response.json();
      if (payload.errors !== undefined && payload.errors.length > 0) {
        throw new DxError("api", `graphql: ${payload.errors.map((error) => error.message).join("; ")}`);
      }
      return payload.data;
    }
  };
}
function rateLimitWait(response, nowMs) {
  if (response.status !== 403 && response.status !== 429) {
    return;
  }
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter !== null) {
    return Number(retryAfter) * 1000;
  }
  if (response.headers.get("x-ratelimit-remaining") === "0") {
    const reset = Number(response.headers.get("x-ratelimit-reset")) * 1000;
    return Math.max(reset - nowMs, 0);
  }
  return response.status === 429 ? 60000 : undefined;
}
function backoff(attempt) {
  return 1000 * 2 ** (attempt - 1);
}
function nextLink(header) {
  if (header === null) {
    return;
  }
  const match = /<([^>]+)>;\s*rel="next"/.exec(header);
  return match?.[1];
}
async function errorText(response) {
  const text = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(text);
    return parsed.message ?? text;
  } catch {
    return text;
  }
}

var FIELDS_FRAGMENT = `
  id number
  fields(first:50) { nodes {
    ... on ProjectV2FieldCommon { id name }
    ... on ProjectV2SingleSelectField { options { id name color description } }
  } }`;
var LOOKUP_QUERY = `
query($org:String!, $num:Int!, $owner:String!, $repo:String!, $number:Int!) {
  viewer { login }
  organization(login:$org) { projectV2(number:$num) { ${FIELDS_FRAGMENT} } }
  repository(owner:$owner, name:$repo) { issueOrPullRequest(number:$number) {
    __typename
    ... on Issue { id title url assignees(first:10) { nodes { login } }
      projectItems(first:20) { nodes { id project { id }
        fieldValueByName(name:"Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } } } } }
    ... on PullRequest { id title url assignees(first:10) { nodes { login } }
      projectItems(first:20) { nodes { id project { id }
        fieldValueByName(name:"Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } } } } }
  } }
}`;
var PROJECT_QUERY = `
query($org:String!, $num:Int!) {
  organization(login:$org) { projectV2(number:$num) { ${FIELDS_FRAGMENT} } }
}`;

var OPEN_STATUSES = new Set(["Backlog", "Ready", "In progress", "In review", "Blocked"]);
var CLOSED_LIKE = new Set(["CLOSED", "MERGED"]);
var ASSIGNEE_FORBIDDEN = new Set(["Backlog", "Ready"]);
function pySplitLines(text) {
  const lines = text.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/u);
  if (lines.at(-1) === "") {
    lines.pop();
  }
  return lines;
}

async function git(dir, args) {
  return exec(["git", "-C", dir, ...args]);
}
async function countCommits(dir, range) {
  const result = await git(dir, ["rev-list", "--count", ...range]);
  return result.exitCode === 0 ? Number(result.stdout.trim()) : 0;
}

var CONVENTIONAL_TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert"
];
var HEADER = new RegExp(`^(${CONVENTIONAL_TYPES.join("|")})(\\([a-z0-9._/-]+\\))?!?: .+`);
function titleProblem(title) {
  if (!HEADER.test(title)) {
    return `not a 'type(scope): subject' header (type must be one of: ${CONVENTIONAL_TYPES.join(", ")})`;
  }
  if (/\((commit|chore|fix|update|misc)\)/.test(title)) {
    return "scope names the action, not the area affected \u2014 drop it or name the module";
  }
  if (/: [A-Z]/.test(title)) {
    return "subject must be lowercase";
  }
  if (title.endsWith(".")) {
    return "subject must not end in a period";
  }
  return;
}
var KEYWORD_REF = /(close[sd]?|fix(?:e[sd])?|resolve[sd]?|refs?)[:\s]+([A-Za-z0-9._/-]+#[0-9]+|#[0-9]+)/gi;
var CLOSING_KEYWORD = /^(close|fix|resolve)/i;
function classifyRefs(texts) {
  const kinds = new Map;
  for (const fragment of texts) {
    for (const line of pySplitLines(fragment)) {
      for (const match of line.matchAll(KEYWORD_REF)) {
        const keyword = match[1];
        const ref = match[2];
        const kind = CLOSING_KEYWORD.test(keyword) ? "close" : "ref";
        if (!kinds.has(ref) || kind === "close") {
          kinds.set(ref, kind);
        }
      }
    }
  }
  return [...kinds].map(([ref, kind]) => ({ kind, ref }));
}
function repoApi(github, repo) {
  return async (path) => {
    if (repo === undefined || repo === "") {
      return;
    }
    try {
      const client = await github();
      const value = await client.request("GET", `repos/${repo}/${path}`);
      return value ?? undefined;
    } catch {
      return;
    }
  };
}
async function repoInfo(github, slug) {
  if (!slug.includes("/")) {
    return;
  }
  try {
    const client = await github();
    const repo = await client.request("GET", `repos/${slug}`);
    if (typeof repo.full_name !== "string" || typeof repo.default_branch !== "string") {
      return;
    }
    return { fullName: repo.full_name, defaultBranch: repo.default_branch };
  } catch {
    return;
  }
}
var PROMOTION_TITLE = /^(Promote .* (?:\u2192|->) .*|Merge .* into (main|test|development))/;
var PROMOTION_BODY = /^Promotes\s+`[^`]+`\s+(?:\u2192|->)\s+`[^`]+`/;
var MAX_DEPTH = 12;
function asRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined;
}
function asString(value) {
  return typeof value === "string" ? value : "";
}
function toPull(value) {
  return { number: Number(value.number), title: asString(value.title), body: asString(value.body) };
}

class Harvester {
  pullForCommit = new Map;
  pullCommitsCache = new Map;
  dir;
  api;
  constructor(dir, api) {
    this.dir = dir;
    this.api = api;
  }
  async harvest(range, deliveredOnly) {
    const texts = [];
    const seen = new Set;
    for (const sha of await this.rangeShas(range, deliveredOnly)) {
      await this.gather(sha, texts, seen, 0);
    }
    return classifyRefs(texts);
  }
  async rangeShas(range, deliveredOnly) {
    const log = await git(this.dir, ["log", "--reverse", "--format=%H", range]);
    const ordered = log.stdout.split(`
`).filter((sha) => sha !== "");
    if (!deliveredOnly || !range.includes("..")) {
      return ordered;
    }
    const split = range.indexOf("..");
    const cherry = await git(this.dir, ["cherry", range.slice(0, split), range.slice(split + 2)]);
    const lines = cherry.stdout.split(`
`).filter((line) => line.trim() !== "");
    if (lines.length === 0) {
      return ordered;
    }
    const delivered = new Set(lines.filter((line) => line.startsWith("+")).map((line) => line.split(/\s+/)[1]).filter((sha) => sha !== ""));
    return ordered.filter((sha) => delivered.has(sha));
  }
  async gather(sha, texts, seen, depth) {
    if (seen.has(sha) || depth > MAX_DEPTH) {
      return;
    }
    seen.add(sha);
    const pull = await this.pullFor(sha);
    if (pull !== undefined && (PROMOTION_TITLE.test(pull.title) || PROMOTION_BODY.test(pull.body))) {
      const before = texts.length;
      for (const inner of await this.pullCommits(pull.number)) {
        await this.gather(inner.sha, texts, seen, depth + 1);
      }
      if (texts.length === before) {
        for (const named of await this.pullsNamedIn(pull.title)) {
          if (named.body !== "") {
            texts.push(named.body);
          }
          await this.pushMessages(named.number, texts);
        }
      }
      return;
    }
    if (pull !== undefined) {
      if (pull.body !== "") {
        texts.push(pull.body);
      }
      await this.pushMessages(pull.number, texts);
      return;
    }
    texts.push((await git(this.dir, ["log", "--format=%B", "-1", sha])).stdout);
  }
  async pushMessages(number, texts) {
    for (const commit of await this.pullCommits(number)) {
      if (commit.message !== "") {
        texts.push(commit.message);
      }
    }
  }
  async pullFor(sha) {
    if (this.pullForCommit.has(sha)) {
      return this.pullForCommit.get(sha);
    }
    const listed = await this.api(`commits/${sha}/pulls`);
    const merged = (Array.isArray(listed) ? listed : []).map(asRecord).find((pull) => pull !== undefined && isTruthy(pull.merged_at));
    const found = merged ?? await this.pullFromSubject(sha);
    const pull = found === undefined ? undefined : toPull(found);
    this.pullForCommit.set(sha, pull);
    return pull;
  }
  async pullFromSubject(sha) {
    const subject = (await git(this.dir, ["log", "--format=%s", "-1", sha])).stdout.trim();
    const match = /\(#(\d+)\)$/.exec(subject);
    if (match === null) {
      return;
    }
    const pull = asRecord(await this.api(`pulls/${match[1]}`));
    if (pull === undefined || !isTruthy(pull.merged_at) || pull.merge_commit_sha !== sha) {
      return;
    }
    return pull;
  }
  async pullCommits(number) {
    const cached = this.pullCommitsCache.get(number);
    if (cached !== undefined) {
      return cached;
    }
    const listed = await this.api(`pulls/${String(number)}/commits`);
    const commits = (Array.isArray(listed) ? listed : []).map((entry) => {
      const commit = asRecord(entry) ?? {};
      return { sha: asString(commit.sha), message: asString(asRecord(commit.commit)?.message) };
    });
    this.pullCommitsCache.set(number, commits);
    return commits;
  }
  async pullsNamedIn(title) {
    const numbers = [...new Set([...title.matchAll(/\(#(\d+)\)/g)].map((match) => match[1]))];
    const pulls = [];
    for (const number of numbers) {
      const pull = asRecord(await this.api(`pulls/${number}`));
      if (pull !== undefined && Object.keys(pull).length > 0) {
        pulls.push(toPull(pull));
      }
    }
    return pulls;
  }
}
function isTruthy(value) {
  return value !== undefined && value !== null && value !== "" && value !== false && value !== 0;
}
async function harvestRefs(options) {
  return new Harvester(options.dir, options.api).harvest(options.range, options.deliveredOnly === true);
}
async function runStamps(dir, range) {
  const log = await git(dir, ["log", "--reverse", "--format=%B", range]);
  const lines = log.stdout.split(`
`);
  const stamps = new Set(lines.filter((line) => line.startsWith("Millwright-Run: ")));
  const authors = new Map;
  for (const line of lines) {
    const key = line.toLowerCase();
    if (key.startsWith("co-authored-by: ") && !authors.has(key)) {
      authors.set(key, line);
    }
  }
  return [...stamps, ...authors.values()];
}
async function synthesizePr(options) {
  const { dir, base, from } = options;
  const promotion = from !== undefined;
  const range = promotion ? `origin/${base}..origin/${from}` : `origin/${base}..HEAD`;
  const commits = await countCommits(dir, [range]);
  if (commits === 0) {
    return { ok: false, reason: "empty", commits };
  }
  const subject = commits === 1 ? (await git(dir, ["log", "--format=%s", "-1", range])).stdout.replace(/\n+$/, "") : "";
  const plural = commits === 1 ? "" : "s";
  const bullets = (await git(dir, ["log", "--reverse", "--format=- %s", range])).stdout.replace(/\n+$/, "");
  let title = options.title ?? "";
  let body;
  if (promotion) {
    const isPromotion = commits === 1 && /^Promote .* \u2192 .* \([0-9]+ commits?\)|^Merge .* into (main|test|development)/.test(subject);
    if (title === "") {
      title = commits === 1 && !isPromotion ? subject : `Promote ${from} \u2192 ${base} (${String(commits)} commits)`;
    }
    body = `Promotes \`${from}\` \u2192 \`${base}\` (${String(commits)} commit${plural}).

${bullets}`;
  } else {
    if (commits === 1 && title === "") {
      title = subject;
    } else if (title === "") {
      return { ok: false, reason: "needs-title", commits };
    }
    const summary = options.summary === undefined || options.summary === "" ? title : options.summary;
    body = `${summary} (${String(commits)} commit${plural}).

${bullets}`;
  }
  const refs = await harvestRefs({ dir, range, api: options.api, deliveredOnly: promotion });
  let refsOneline = "";
  if (refs.length > 0) {
    const closing = base === await options.closingBranch();
    const trailers = refs.map(({ kind, ref }) => `${closing && kind === "close" ? "Closes" : "Refs"} ${ref}`);
    body = `${body}

${trailers.map((line) => `${line}
`).join("")}`;
    refsOneline = trailers.join(" ");
  }
  const stamps = await runStamps(dir, range);
  if (stamps.length > 0) {
    body = `${body.replace(/\n$/, "")}

${stamps.map((line) => `${line}
`).join("")}`;
  }
  return { ok: true, title, commits, body, refsOneline, subject };
}

function same(a, b) {
  return a.replace(/\n+$/, "") === b.replace(/\n+$/, "");
}
async function refreshPr(options) {
  const { dir, repo, base, pr, client } = options;
  const github = async () => Promise.resolve(client);
  const info = await repoInfo(github, repo);
  const path = `repos/${repo}/pulls/${String(pr)}`;
  const current = await client.request("GET", path);
  const currentTitle = current.title ?? "";
  const currentBody = current.body ?? "";
  const inputs = {
    dir,
    base,
    closingBranch: async () => Promise.resolve(info?.defaultBranch ?? "main"),
    api: repoApi(github, info?.fullName ?? repo)
  };
  let synthesis = await synthesizePr(inputs);
  const invalidSubject = synthesis.ok && synthesis.commits === 1 && titleProblem(synthesis.subject) !== undefined;
  if (!synthesis.ok && synthesis.reason === "needs-title" || invalidSubject) {
    synthesis = await synthesizePr({ ...inputs, title: currentTitle });
  }
  if (!synthesis.ok) {
    throw new DxError("error", `no commits ahead of origin/${base} \u2014 nothing to synthesize`);
  }
  let message;
  let changed = false;
  if (synthesis.title === currentTitle && same(synthesis.body, currentBody)) {
    message = `PR #${String(pr)} title/body already current`;
  } else {
    await client.request("PATCH", path, { title: synthesis.title, body: synthesis.body });
    changed = true;
    message = `PR #${String(pr)} title/body refreshed from origin/${base}..HEAD`;
  }
  const problem = titleProblem(synthesis.title);
  if (problem !== undefined) {
    const fix = invalidSubject ? `the commit subject "${synthesis.subject}" is not one either \u2014 amend it (git commit --amend) and force-push` : "retitle the PR";
    throw new DxError("error", `${message}, but its title "${synthesis.title}" is not a Conventional Commit header (${problem}); ${fix}`);
  }
  return { changed, message };
}
async function checkPrTitle(options) {
  const { repo, pr, client } = options;
  const current = await client.request("GET", `repos/${repo}/pulls/${String(pr)}`);
  const title = current.title ?? "";
  const problem = titleProblem(title);
  if (problem === undefined) {
    return { ok: true, message: `PR #${String(pr)} title is a Conventional Commit header` };
  }
  return {
    ok: false,
    message: [
      `PR #${String(pr)} title "${title}" is not a Conventional Commit header (${problem}).`,
      "It becomes the squash commit's subject: retitle the PR, or for a single-commit branch amend",
      "the commit (git commit --amend) and force-push so refresh-pr retitles it."
    ].join(`
`)
  };
}

async function run(argv, env) {
  const repo = env.GITHUB_REPOSITORY ?? "";
  if (argv.at(0) === "--check-title") {
    const number = argv.at(1) ?? "";
    if (!/^\d+$/.test(number) || repo === "") {
      process.stderr.write(`usage: refresh-pr.js --check-title <pr-number> (GITHUB_REPOSITORY set)
`);
      return 2;
    }
    const client = createGitHubClient({ token: await resolveToken(env) });
    const check = await checkPrTitle({ repo, pr: Number(number), client });
    process.stdout.write(`${check.message}
`);
    return check.ok ? 0 : 1;
  }
  const base = argv.at(0) ?? "";
  const pr = argv.at(1) ?? "";
  if (base === "" || !/^\d+$/.test(pr) || repo === "") {
    process.stderr.write(`usage: refresh-pr.js <base-branch> <pr-number> (GITHUB_REPOSITORY set)
`);
    return 2;
  }
  const client = createGitHubClient({ token: await resolveToken(env) });
  const result = await refreshPr({
    dir: env.GITHUB_WORKSPACE ?? process.cwd(),
    repo,
    base,
    pr: Number(pr),
    client
  });
  process.stdout.write(`${result.message}
`);
  return 0;
}
run(process.argv.slice(2), process.env).then((code) => process.exit(code), (error) => {
  process.stderr.write(`refresh-pr: ${describeError(error).message}
`);
  process.exit(1);
});
