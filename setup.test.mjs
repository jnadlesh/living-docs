import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { test } from "node:test";
import { githubFromRemote, parseArgs, setup, withBlock } from "./setup.mjs";
import { areaLabels, readTiers } from "./template/tools/github.mjs";
import { formatDate, localToday } from "./template/tools/lib/checks.mjs";

const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" });

function makeCodeRepo(base, { branch = "main", remote = "https://github.com/priya/my-app.git" } = {}) {
  const code = join(base, "my-app");
  mkdirSync(join(code, "src"), { recursive: true });
  git(code, "init", "-q", "-b", branch);
  git(code, "config", "user.email", "test@example.test");
  git(code, "config", "user.name", "Test");
  if (remote) git(code, "remote", "add", "origin", remote);
  writeFileSync(join(code, "src/server.ts"), "export const port = 1;\n");
  writeFileSync(join(code, "AGENTS.md"), "# Existing rules\n\nKeep these.\n");
  git(code, "add", "-A");
  git(code, "commit", "-q", "-m", "start");
  return code;
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => (name === ".git" ? [] : statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));

const read = (...parts) => readFileSync(join(...parts), "utf8");

test("setup makes a documentation repository whose own check passes, and leaves pointers, forms and hooks", () => {
  const base = mkdtempSync(join(tmpdir(), "living-docs-"));
  const code = makeCodeRepo(base);
  const docs = join(base, "my-app-docs");
  const result = setup(["--project", "My App", "--owner", "Priya", "--code", code, "--docs", docs, "--root", base, "--no-git"]);
  assert.equal(result.checked, "0 errors, 0 warnings.");
  assert.equal(result.github, "priya/my-app");
  assert.deepEqual(result.notes, []);
  assert.deepEqual(JSON.parse(read(docs, "docs.config.json")), { project: "My App", codeRepo: "../my-app", codeRef: "main", github: "priya/my-app", owner: "Priya" });
  assert.match(read(docs, "NOW.md"), /## Waiting on the owner/);
  assert.match(read(docs, "rules/code/issues.md"), /\[priya\/my-app\]\(https:\/\/github\.com\/priya\/my-app\/issues\)/);

  const agents = read(code, "AGENTS.md");
  assert.match(agents, /lives in a separate repository at `\.\.\/my-app-docs`/);
  assert.match(agents, /GitHub issue on this repository: https:\/\/github\.com\/priya\/my-app\/issues/);
  assert.match(agents, /# Existing rules\n\nKeep these\./);
  assert.equal(read(code, "CLAUDE.md"), "@AGENTS.md\n");
  assert.match(read(code, ".github/ISSUE_TEMPLATE/bug.yml"), /labels: \[bug, from-user, triage\]/);
  assert.equal(read(code, ".github/ISSUE_TEMPLATE/config.yml"), "blank_issues_enabled: false\ncontact_links: []\n");
  assert.match(read(code, ".github/pull_request_template.md"), /The pages in my-app-docs this change touches/);
  const codeHook = JSON.parse(read(code, ".claude/settings.json")).hooks.SessionStart[0].hooks[0];
  assert.match(codeHook.command, /\$CLAUDE_PROJECT_DIR\/\.\.\/my-app-docs\/tools\/session-start\.mjs/);

  assert.match(read(base, "AGENTS.md"), /`my-app-docs\/` is all the documentation/);
  const rootHook = JSON.parse(read(base, ".claude/settings.json")).hooks.SessionStart[0].hooks[0];
  assert.match(rootHook.command, /\$CLAUDE_PROJECT_DIR\/my-app-docs\/tools\/session-start\.mjs/);
  const loaded = execFileSync(process.execPath, [join(docs, "tools/session-start.mjs")], { encoding: "utf8" });
  assert.match(loaded, /## Waiting on the owner/);
  assert.match(loaded, /All work is a GitHub issue on priya\/my-app: https:\/\/github\.com\/priya\/my-app\/issues/);
});

test("a new repository gets no unfilled blank, nothing from the project it was built for, and Unix line endings", () => {
  const base = mkdtempSync(join(tmpdir(), "living-docs-"));
  const code = makeCodeRepo(base);
  const docs = join(base, "my-app-docs");
  setup(["--project", "My App", "--owner", "Priya", "--code", code, "--docs", docs, "--root", base, "--no-git"]);
  const written = [...walk(docs), ...walk(join(code, ".github")), join(code, "AGENTS.md"), join(base, "AGENTS.md")];
  const offenders = written.filter((file) => /\{\{|Aurelia|Jonathan|outerfleet|C:\\\\dev/i.test(read(file)));
  assert.deepEqual(offenders.map((file) => relative(base, file)), []);
  // A Windows checkout of the skill has Windows line endings. What setup writes must not.
  const windowsEndings = written.filter((file) => read(file).includes("\r"));
  assert.deepEqual(windowsEndings.map((file) => relative(base, file)), []);
});

test("the new repository names its GitHub labels and milestones from its own pages, and its tools' tests pass there", () => {
  const base = mkdtempSync(join(tmpdir(), "living-docs-"));
  const code = makeCodeRepo(base);
  const docs = join(base, "my-app-docs");
  setup(["--project", "My App", "--owner", "Priya", "--code", code, "--docs", docs, "--no-code-files", "--no-git"]);
  assert.deepEqual(areaLabels(docs).map((label) => label.name), ["product", "docs"]);
  assert.deepEqual(readTiers(docs).map((tier) => tier.title), ["1 Bugs and usability", "2 Finish what is half built", "3 Later"]);
  // A test run started inside another one reports to its parent unless it is told it is on its own.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const output = execFileSync(process.execPath, ["--test", "tools/test/*.test.mjs"], { cwd: docs, encoding: "utf8", env });
  assert.match(output, /ℹ fail 0/);
  assert.doesNotMatch(output, /ℹ tests 0\b/);
});

test("a page written in the new repository is checked against the real code", () => {
  const base = mkdtempSync(join(tmpdir(), "living-docs-"));
  const code = makeCodeRepo(base);
  const docs = join(base, "docs-repo");
  setup(["--project", "My App", "--owner", "Priya", "--code", code, "--docs", docs, "--no-code-files", "--no-git"]);
  const page = (path) => ["# Server", "", "## What it is", "", "The server answers requests. It is small.", "", "## How it works", "",
    "It listens, and answers.", "", "## Where it lives", "", `- \`${path}\` the server`, "", "## Related", "", "- None.", "",
    "## Decisions", "", "- None recorded.", "", "## Last checked", "", formatDate(localToday()), ""].join("\n");
  const run = (args) => {
    try {
      return execFileSync(process.execPath, args, { cwd: docs, encoding: "utf8" });
    } catch (failure) {
      return failure.stdout;
    }
  };
  writeFileSync(join(docs, "docs/01-the-product/server.md"), page("src/server.ts"));
  run(["tools/build-indexes.mjs"]);
  assert.match(run(["tools/check.mjs"]), /0 errors, 0 warnings\./);
  assert.match(read(docs, "docs/01-the-product/README.md"), /\| \[Server\]\(server\.md\) \| The server answers requests\. \| `src\/server\.ts` \|/);
  writeFileSync(join(docs, "docs/01-the-product/server.md"), page("src/gone.ts"));
  assert.match(run(["tools/check.mjs"]), /path not found in the code: src\/gone\.ts/);
});

test("files the code repository already has are kept, and a note says what to add by hand", () => {
  const base = mkdtempSync(join(tmpdir(), "living-docs-"));
  const code = makeCodeRepo(base);
  mkdirSync(join(code, ".github/ISSUE_TEMPLATE"), { recursive: true });
  mkdirSync(join(code, ".claude"), { recursive: true });
  writeFileSync(join(code, ".github/ISSUE_TEMPLATE/bug.yml"), "name: Their bug form\n");
  writeFileSync(join(code, ".claude/settings.json"), "{\"theirs\": true}\n");
  const result = setup(["--project", "My App", "--owner", "Priya", "--code", code, "--docs", join(base, "d"), "--no-git"]);
  assert.equal(read(code, ".github/ISSUE_TEMPLATE/bug.yml"), "name: Their bug form\n");
  assert.equal(read(code, ".claude/settings.json"), "{\"theirs\": true}\n");
  assert.ok(existsSync(join(code, ".github/ISSUE_TEMPLATE/feature.yml")));
  assert.equal(result.notes.length, 2);
  assert.match(result.notes[0], /kept the existing \.github\/ISSUE_TEMPLATE\/bug\.yml/);
  assert.match(result.notes[1], /settings\.json already exists[\s\S]*session-start\.mjs/);
});

test("the repository on GitHub and the branch are found, or setup stops before writing anything", () => {
  const base = mkdtempSync(join(tmpdir(), "living-docs-"));
  const code = makeCodeRepo(base, { branch: "master", remote: "git@github.com:priya/my-app.git" });
  const docs = join(base, "d");
  const result = setup(["--project", "X", "--owner", "Y", "--code", code, "--docs", docs, "--no-git", "--no-code-files"]);
  assert.equal(result.github, "priya/my-app");
  assert.equal(result.ref, "master");

  const lonely = mkdtempSync(join(tmpdir(), "living-docs-"));
  const noRemote = makeCodeRepo(lonely, { remote: null });
  assert.throws(() => setup(["--project", "X", "--owner", "Y", "--code", noRemote, "--docs", join(lonely, "d")]), /no origin remote on GitHub[\s\S]*--github owner\/name/);
  assert.equal(existsSync(join(lonely, "d")), false);
  const withName = setup(["--project", "X", "--owner", "Y", "--code", noRemote, "--docs", join(lonely, "d"), "--github", "priya/elsewhere", "--no-git"]);
  assert.equal(withName.github, "priya/elsewhere");

  assert.equal(githubFromRemote("https://github.com/priya/my-app"), "priya/my-app");
  assert.equal(githubFromRemote("ssh://git@github.com/priya/my-app.git\n"), "priya/my-app");
  assert.equal(githubFromRemote("https://gitlab.com/priya/my-app.git"), null);
});

test("setup refuses a folder that already has files, and changes nothing", () => {
  const base = mkdtempSync(join(tmpdir(), "living-docs-"));
  const code = makeCodeRepo(base);
  assert.throws(() => setup(["--project", "X", "--owner", "Y", "--code", code, "--docs", code]), /already exists and is not empty/);
  assert.equal(existsSync(join(code, "NOW.md")), false);
  const notGit = mkdtempSync(join(tmpdir(), "living-docs-"));
  assert.throws(() => setup(["--project", "X", "--owner", "Y", "--code", notGit, "--docs", join(base, "d")]), /is not a git repository/);
});

test("arguments are validated, and the pointer block is refreshed in place", () => {
  assert.throws(() => parseArgs(["--project", "X"]), /--owner is required/);
  assert.throws(() => parseArgs(["--project", "X", "--owner", "Y", "--code", "a", "--docs", "b", "--ref", "--upload-pack=x"]), /plain branch name/);
  assert.throws(() => parseArgs(["--project", "X", "--owner", "Y", "--code", "a", "--docs", "b", "--github", "https://github.com/a/b"]), /owner\/name/);
  assert.throws(() => parseArgs(["--projcet", "X"]), /unexpected argument: --projcet/);
  const once = withBlock("# Mine\n", "first");
  const twice = withBlock(once, "second");
  assert.match(twice, /second/);
  assert.doesNotMatch(twice, /first/);
  assert.equal(twice.match(/living-docs:start/g).length, 1);
  assert.match(twice, /# Mine/);
});
