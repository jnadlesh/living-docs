import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parseArgs, setup, withBlock } from "./setup.mjs";

const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" });

function makeCodeRepo(base) {
  const code = join(base, "my-app");
  mkdirSync(join(code, "src"), { recursive: true });
  git(code, "init", "-q", "-b", "main");
  git(code, "config", "user.email", "test@example.test");
  git(code, "config", "user.name", "Test");
  writeFileSync(join(code, "src/server.ts"), "export const port = 1;\n");
  writeFileSync(join(code, "AGENTS.md"), "# Existing rules\n\nKeep these.\n");
  git(code, "add", "-A");
  git(code, "commit", "-q", "-m", "start");
  return code;
}

test("setup makes a documentation repository whose own check passes, and leaves pointers", () => {
  const base = mkdtempSync(join(tmpdir(), "living-docs-"));
  const code = makeCodeRepo(base);
  const docs = join(base, "my-app-docs");
  const result = setup(["--project", "My App", "--owner", "Priya", "--code", code, "--docs", docs, "--root", base, "--no-git"]);
  assert.equal(result.checked, "0 errors, 0 warnings.");
  assert.match(readFileSync(join(docs, "NOW.md"), "utf8"), /## Waiting on Priya/);
  assert.deepEqual(JSON.parse(readFileSync(join(docs, "docs.config.json"), "utf8")), { codeRepo: "../my-app", codeRef: "main", owner: "Priya" });
  assert.doesNotMatch(readFileSync(join(docs, "README.md"), "utf8"), /\{\{|Aurelia|Jonathan/);

  const agents = readFileSync(join(code, "AGENTS.md"), "utf8");
  assert.match(agents, /lives in a separate repository at `\.\.\/my-app-docs`/);
  assert.match(agents, /# Existing rules\n\nKeep these\./);
  assert.equal(readFileSync(join(code, "CLAUDE.md"), "utf8"), "@AGENTS.md\n");
  assert.match(readFileSync(join(base, "AGENTS.md"), "utf8"), /`my-app-docs\/` is all the documentation/);
});

test("a page written in the new repository is checked against the real code", () => {
  const base = mkdtempSync(join(tmpdir(), "living-docs-"));
  const code = makeCodeRepo(base);
  const docs = join(base, "docs-repo");
  setup(["--project", "My App", "--owner", "Priya", "--code", code, "--docs", docs, "--no-pointer", "--no-git"]);
  const page = (path) => ["# Server", "", "## What it is", "", "The server answers requests. It is small.", "", "## How it works", "",
    "1. It listens.", "", "## Where it lives", "", `- \`${path}\` the server`, "", "## Related", "", "- None.", "",
    "## Decisions", "", "- None recorded.", "", "## Last checked", "", new Date().toISOString().slice(0, 10), ""].join("\n");
  const run = (args) => {
    try {
      return execFileSync(process.execPath, args, { cwd: docs, encoding: "utf8" });
    } catch (failure) {
      return failure.stdout;
    }
  };
  writeFileSync(join(docs, "docs/01-what-it-is/server.md"), page("src/server.ts"));
  run(["tools/build-indexes.mjs"]);
  assert.match(run(["tools/check.mjs"]), /0 errors, 0 warnings\./);
  assert.match(readFileSync(join(docs, "docs/01-what-it-is/README.md"), "utf8"), /\| \[Server\]\(server\.md\) \| The server answers requests\. \| `src\/server\.ts` \|/);
  writeFileSync(join(docs, "docs/01-what-it-is/server.md"), page("src/gone.ts"));
  assert.match(run(["tools/check.mjs"]), /path not found in the code: src\/gone\.ts/);
});

test("setup refuses a folder that already has files, and changes nothing", () => {
  const base = mkdtempSync(join(tmpdir(), "living-docs-"));
  const code = makeCodeRepo(base);
  assert.throws(() => setup(["--project", "X", "--owner", "Y", "--code", code, "--docs", code]), /already exists and is not empty/);
  assert.equal(existsSync(join(code, "NOW.md")), false);
});

test("arguments are validated, and the pointer block is refreshed in place", () => {
  assert.throws(() => parseArgs(["--project", "X"]), /--owner is required/);
  assert.throws(() => parseArgs(["--project", "X", "--owner", "Y", "--code", "a", "--docs", "b", "--ref", "--upload-pack=x"]), /plain branch name/);
  const once = withBlock("# Mine\n", "first");
  const twice = withBlock(once, "second");
  assert.match(twice, /second/);
  assert.doesNotMatch(twice, /first/);
  assert.equal(twice.match(/living-docs:start/g).length, 1);
  assert.match(twice, /# Mine/);
});
