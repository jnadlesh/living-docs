import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkDecision, checkUniqueTitles, checkNow, checkPage, checkRetiredWords, checkTask, parseDate, parseRetiredWords } from "../lib/checks.mjs";
import { isPlainRepoPath } from "../lib/code-repo.mjs";

const TODAY = new Date("2026-09-17T00:00:00Z");
const OWNER = "Jonathan";
const TRACKED = new Set(["packages", "packages/ui", "packages/ui/src", "packages/ui/src/island.tsx"]);

const page = (overrides = {}) => {
  const parts = {
    what: "The island shows progress. It sits above the composer.",
    where: "- `packages/ui/src/island.tsx` the pill",
    checked: "2026-09-17",
    ...overrides,
  };
  return [
    "# The island", "", "## What it is", "", parts.what, "", "## How it works", "", "1. It shows.", "",
    "## Where it lives", "", parts.where, "", "## Related", "", "- None.", "",
    "## Decisions", "", "- None recorded.", "", "## Last checked", "", parts.checked, "",
  ].join("\n");
};

const run = (text, tracked = TRACKED) =>
  checkPage({ root: mkdtempSync(join(tmpdir(), "docs-")), file: "docs/02-the-chat/island.md", text, tracked, today: TODAY });

const messages = (problems, level = "error") => problems.filter((p) => p.level === level).map((p) => p.message);

test("a well-formed page has no problems", () => {
  assert.deepEqual(run(page()), []);
});

test("a missing or reordered heading is an error", () => {
  const text = page().replace("## Related\n\n- None.\n\n", "");
  assert.match(messages(run(text))[0], /headings must be exactly/);
});

test("a path that is not in the code is an error", () => {
  assert.deepEqual(messages(run(page({ where: "- `packages/ui/src/gone.tsx`" }))), [
    "path not found in the code: packages/ui/src/gone.tsx",
  ]);
});

test("a folder path with a trailing slash is accepted", () => {
  assert.deepEqual(run(page({ where: "- `packages/ui/`" })), []);
});

test("a path must be written from the repository root", () => {
  for (const bad of ["../x", "C:/x", "/abs", "a\\b", "src/*.ts", "-rf"]) assert.equal(isPlainRepoPath(bad), false, bad);
  assert.match(messages(run(page({ where: "- `../outside.ts`" })))[0], /from the repository root/);
});

test("a page with no listed path is an error", () => {
  assert.match(messages(run(page({ where: "Somewhere." })))[0], /at least one path/);
});

test("last checked must be a real date, not in the future, and warns when old", () => {
  assert.match(messages(run(page({ checked: "yesterday" })))[0], /YYYY-MM-DD/);
  assert.match(messages(run(page({ checked: "2026-02-30" })))[0], /YYYY-MM-DD/);
  assert.match(messages(run(page({ checked: "2027-01-01" })))[0], /future/);
  assert.match(messages(run(page({ checked: "2026-01-01" })), "warning")[0], /days ago/);
});

test("a page over the cap is an error", () => {
  const long = page({ what: Array.from({ length: 160 }, (_, i) => `Line ${i}.`).join("\n") });
  assert.match(messages(run(long))[0], /the cap is 150/);
});

test("a broken link is an error and a working one is not", () => {
  const root = mkdtempSync(join(tmpdir(), "docs-"));
  writeFileSync(join(root, "real.md"), "# Real\n");
  const text = page({ what: "See [real](real.md) and [gone](gone.md). Second." });
  const problems = checkPage({ root, file: "page.md", text, tracked: TRACKED, today: TODAY });
  assert.deepEqual(messages(problems), ["broken link: gone.md"]);
});

const now = (inFlight) =>
  ["# Now", "", "Updated: 2026-09-17, by Claude", "", "## In flight", "", inFlight, "", "## Waiting on Jonathan", "",
    "## Next up", "", "1. 2026-09-17 A thing.", "", "## Parked", "", "## Watch out", ""].join("\n");

test("NOW.md accepts dated lines and warns on old in-flight work", () => {
  assert.deepEqual(checkNow({ file: "NOW.md", text: now("- 2026-09-16 Usage page."), today: TODAY, owner: OWNER }), []);
  const old = checkNow({ file: "NOW.md", text: now("- 2026-09-01 Usage page."), today: TODAY, owner: OWNER });
  assert.match(messages(old, "warning")[0], /is it still true/);
});

test("NOW.md rejects undated lines, relative dates and a missing Updated line", () => {
  const undated = checkNow({ file: "NOW.md", text: now("- yesterday Usage page."), today: TODAY, owner: OWNER });
  assert.match(messages(undated)[0], /real date/);
  const noUpdated = now("- 2026-09-16 X.").replace("Updated: 2026-09-17, by Claude", "");
  assert.match(messages(checkNow({ file: "NOW.md", text: noUpdated, today: TODAY, owner: OWNER }))[0], /Updated:/);
});

test("NOW.md over sixty lines is an error", () => {
  const many = Array.from({ length: 70 }, (_, i) => `- 2026-09-17 Thing ${i}.`).join("\n");
  assert.ok(messages(checkNow({ file: "NOW.md", text: now(many), today: TODAY, owner: OWNER })).some((m) => /the cap is 60/.test(m)));
});

const task = (status) =>
  ["# Task", "", "Started: 2026-09-17", "Last touched: 2026-09-17", "", "## What you asked for", "", "\"Words.\"", "",
    "## What done looks like", "", "1. X.", "", "## Notes", "", "- N.", "", "## Status", "", status, ""].join("\n");

test("a task file needs its dates, its headings and a known status", () => {
  assert.deepEqual(checkTask({ file: "work/t.md", text: task("in progress") }), []);
  assert.deepEqual(checkTask({ file: "work/t.md", text: task("Blocked on Jonathan.") }), []);
  assert.match(messages(checkTask({ file: "work/t.md", text: task("nearly") }))[0], /Status must start with/);
  const undated = task("done").replace("Started: 2026-09-17\n", "");
  assert.match(messages(checkTask({ file: "work/t.md", text: undated }))[0], /Started/);
});

test("retired words are read from the table and caught in prose, not in code blocks", () => {
  const table = "| Do not write | Write instead | Why |\n|---|---|---|\n| Playbook | Skill | Renamed. |\n";
  const words = parseRetiredWords(table);
  assert.deepEqual(words, [{ retired: "Playbook", current: "Skill" }]);
  assert.match(messages(checkRetiredWords("p.md", "Run the playbooks.", words))[0], /Write "Skill"/);
  assert.deepEqual(checkRetiredWords("p.md", "A Skill.\n```\nplaybook\n```\n", words), []);
});

test("parseDate accepts only real calendar dates", () => {
  assert.ok(parseDate("2026-09-17"));
  assert.equal(parseDate("2026-13-01"), null);
  assert.equal(parseDate("17-09-2026"), null);
});

test("a malformed percent in a link is a broken link, not a crash", () => {
  const problems = run(page({ what: "See [odd](100%.md). Second." }));
  assert.deepEqual(messages(problems), ["broken link: 100%.md"]);
});

test("NOW.md checks star bullets too, and allows a colon after the date", () => {
  assert.match(messages(checkNow({ file: "NOW.md", text: now("* undated line"), today: TODAY, owner: OWNER }))[0], /real date/);
  assert.deepEqual(checkNow({ file: "NOW.md", text: now("- 2026-09-17: fixed the thing."), today: TODAY, owner: OWNER }), []);
});

test("a retired word inside backticks or a link address is left alone", () => {
  const words = [{ retired: "Playbook", current: "Skill" }];
  assert.deepEqual(checkRetiredWords("p.md", "See `packages/playbook/src` and [the page](https://x.test/playbook).", words), []);
  assert.equal(checkRetiredWords("p.md", "See the [playbook](x.md).", words).length, 1);
});

const decision = (status) => `# 0042 — Deny beats allow\n\nStatus: ${status}\n\nThe body.\n`;
const KNOWN = new Map([["0042", "0042-deny-beats-allow.md"], ["0050", "0050-a-later-one.md"]]);
const runDecision = (text, name = "0042-deny-beats-allow.md") =>
  checkDecision({ file: `decisions/${name}`, name, text, known: KNOWN });

test("a decision needs a numbered name, a matching title and a known status", () => {
  assert.deepEqual(runDecision(decision("accepted")), []);
  assert.deepEqual(runDecision(decision("superseded by [0050](0050-a-later-one.md)")), []);
  assert.deepEqual(runDecision(decision("accepted, amended by [0050](0050-a-later-one.md)")), []);
  assert.match(messages(runDecision(decision("fine for now")))[0], /Status: accepted/);
  assert.match(messages(runDecision(decision("accepted"), "deny-beats-allow.md"))[0], /0042-short-title/);
  assert.match(messages(runDecision(decision("accepted").replace("# 0042", "# 0043")))[0], /must start with its number/);
});

test("a status that names another decision must link one that exists", () => {
  assert.match(messages(runDecision(decision("superseded by 0050")))[0], /must link/);
  assert.match(messages(runDecision(decision("superseded by [0099](0099-missing.md)")))[0], /not a decision here/);
});

test("the second heading of NOW.md names the owner from the settings", () => {
  const text = now("- 2026-09-16 Usage page.").replace("Waiting on Jonathan", "Waiting on Priya");
  assert.deepEqual(checkNow({ file: "NOW.md", text, today: TODAY, owner: "Priya" }), []);
  assert.match(messages(checkNow({ file: "NOW.md", text, today: TODAY, owner: "Jonathan" }))[0], /Waiting on Jonathan/);
});

test("two pages cannot share a title", () => {
  const pages = [{ file: "docs/07-a/trust.md", title: "Project trust" }, { file: "docs/10-b/trust.md", title: "project trust" }];
  assert.match(messages(checkUniqueTitles(pages))[0], /already used by docs\/07-a\/trust\.md/);
  assert.deepEqual(checkUniqueTitles([pages[0], { file: "x.md", title: "Something else" }]), []);
});
