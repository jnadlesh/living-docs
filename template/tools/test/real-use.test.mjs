// The whole loop on real files and a real git repository: an agent adds a page, the
// indexes pick it up, the check passes, then the code moves and the check catches it.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildIndexes, staleIndexes } from "../build-indexes.mjs";
import { runChecks } from "../check.mjs";

const TODAY = new Date("2026-09-17T00:00:00Z");
const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" });

function write(root, file, text) {
  mkdirSync(join(root, file, ".."), { recursive: true });
  writeFileSync(join(root, file), text);
}

function makeCodeRepo(base) {
  const repo = join(base, "code");
  mkdirSync(repo);
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "test@example.test");
  git(repo, "config", "user.name", "Test");
  write(repo, "packages/ui/src/island.tsx", "export const island = 1;\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "island");
  return repo;
}

const block = (name) => `<!-- generated:${name}:start -->\n<!-- generated:${name}:end -->\n`;

function makeDocsRepo(base) {
  const root = join(base, "docs-repo");
  write(root, "docs.config.json", JSON.stringify({ codeRepo: "../code", codeRef: "main", owner: "Jonathan" }));
  write(root, "README.md", "# Docs\n\n[Now](NOW.md)\n");
  write(root, "TABLE-OF-CONTENTS.md", `# Table of contents\n\n${block("chapters")}`);
  write(root, "GLOSSARY.md", `# Glossary\n\n${block("glossary")}`);
  write(root, "NOW.md", ["# Now", "", "Updated: 2026-09-17, by Test", "", "## In flight", "", "## Waiting on Jonathan", "",
    "## Next up", "", "## Parked", "", "## Watch out", ""].join("\n"));
  write(root, "rules/retired-words.md", "| Do not write | Write instead | Why |\n|---|---|---|\n| Playbook | Skill | Renamed. |\n");
  write(root, "decisions/README.md", `# Decisions\n\n${block("decisions")}`);
  write(root, "docs/02-the-chat/README.md", `# The chat\n\nThe conversation. More words.\n\n${block("pages")}`);
  return root;
}

const ISLAND = ["# The island", "", "## What it is", "", "The island shows progress. It sits above the composer. Third.", "",
  "## How it works", "", "1. It shows.", "", "## Where it lives", "", "- `packages/ui/src/island.tsx` the pill", "",
  "## Related", "", "- [The chat](README.md)", "", "## Decisions", "", "- None recorded.", "",
  "## Last checked", "", "2026-09-17", ""].join("\n");

function applyIndexes(root) {
  for (const [file, text] of buildIndexes(root)) writeFileSync(join(root, file), text);
}

test("a new page reaches every index, passes the check, and a moved file is caught", () => {
  const base = mkdtempSync(join(tmpdir(), "docs-real-"));
  const code = makeCodeRepo(base);
  const root = makeDocsRepo(base);
  applyIndexes(root);
  assert.deepEqual(runChecks({ root, today: TODAY, useCode: true }), []);

  write(root, "docs/02-the-chat/island.md", ISLAND);
  assert.deepEqual(staleIndexes(root).sort(), ["GLOSSARY.md", "TABLE-OF-CONTENTS.md", "docs/02-the-chat/README.md"]);
  const stale = runChecks({ root, today: TODAY, useCode: true }).map((p) => p.message);
  assert.ok(stale.every((m) => /out of date/.test(m)) && stale.length === 3);

  applyIndexes(root);
  assert.match(readFileSync(join(root, "docs/02-the-chat/README.md"), "utf8"), /\| \[The island\]\(island\.md\) \| The island shows progress\. \| `packages\/ui\/src\/island\.tsx` \|/);
  assert.match(readFileSync(join(root, "TABLE-OF-CONTENTS.md"), "utf8"), /- \[02 The chat\]\(docs\/02-the-chat\/README\.md\): The conversation\. 1 page\./);
  assert.match(readFileSync(join(root, "GLOSSARY.md"), "utf8"), /\*\*The island\*\*: The island shows progress\. It sits above the composer\. \[Read the page\]/);
  assert.deepEqual(runChecks({ root, today: TODAY, useCode: true }), []);

  git(code, "mv", "packages/ui/src/island.tsx", "packages/ui/src/progress-island.tsx");
  git(code, "commit", "-q", "-m", "rename");
  assert.deepEqual(runChecks({ root, today: TODAY, useCode: true }).map((p) => p.message), [
    "path not found in the code: packages/ui/src/island.tsx",
  ]);
});

test("the check reads the named branch, not the folder's checked-out files", () => {
  const base = mkdtempSync(join(tmpdir(), "docs-real-"));
  const code = makeCodeRepo(base);
  const root = makeDocsRepo(base);
  write(root, "docs/02-the-chat/island.md", ISLAND);
  applyIndexes(root);
  git(code, "checkout", "-q", "-b", "old-branch");
  git(code, "rm", "-q", "packages/ui/src/island.tsx");
  git(code, "commit", "-q", "-m", "gone here only");
  assert.deepEqual(runChecks({ root, today: TODAY, useCode: true }), []);
});

test("a chapter that lost its markers is reported by name, and the other checks still run", () => {
  const base = mkdtempSync(join(tmpdir(), "docs-real-"));
  makeCodeRepo(base);
  const root = makeDocsRepo(base);
  applyIndexes(root);
  write(root, "docs/02-the-chat/README.md", "# The chat\n\nThe conversation.\n");
  write(root, "NOW.md", "# Now\n");
  const problems = runChecks({ root, today: TODAY, useCode: true });
  assert.ok(problems.some((p) => p.file === "indexes" && /docs\/02-the-chat\/README\.md: missing generated block "pages"/.test(p.message)));
  assert.ok(problems.some((p) => p.file === "NOW.md"));
});
