// The GitHub step against a stand-in for gh that answers like the real one and records every
// call, so the tests can see exactly what would be sent to GitHub, and that nothing else is.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { FIXED_LABELS, areaLabels, parseOptions, readTiers, setupGithub } from "../github.mjs";

const ORDER = [
  "# The order", "", "Words.", "", "## The tiers", "",
  "1. **1 Bugs and usability**: things that are broken.",
  "2. **2 Finish what is half built**: before anything new.",
  "3. **3 Later.** Everything else.", "",
  "## How it is kept", "", "- Not a tier: **bold** here is ignored.", "",
].join("\n");

function write(root, file, text) {
  mkdirSync(join(root, file, ".."), { recursive: true });
  writeFileSync(join(root, file), text);
}

function makeDocs({ github = "priya/my-app", chapters = ["01-the-product", "02-the-editor"] } = {}) {
  const root = mkdtempSync(join(tmpdir(), "docs-github-"));
  write(root, "docs.config.json", JSON.stringify({ project: "My App", codeRepo: "../my-app", codeRef: "main", github }));
  for (const chapter of chapters) write(root, `docs/${chapter}/README.md`, `# Title of ${chapter}\n\nWhat it covers.\n`);
  write(root, "work/order.md", ORDER);
  return root;
}

const WRITES = [["label", "create"], ["api", "--method"], ["project", "create"], ["project", "link"], ["project", "field-create"]];
const isWrite = (args) => WRITES.some(([a, b]) => args[0] === a && args[1] === b);

/** A stand-in for gh holding a repository's labels and milestones, and the owner's boards. */
function fakeGh({ labels = [], milestones = [], projects = [], fields = [], signedIn = true } = {}) {
  const calls = [];
  const gh = (args) => {
    calls.push(args);
    const [a, b] = args;
    if (a === "api" && b === "user") {
      if (!signedIn) throw new Error("gh api user failed: HTTP 401: Bad credentials");
      return "priya\n";
    }
    if (a === "label" && b === "list") return JSON.stringify(labels.map((name) => ({ name })));
    if (a === "api" && b.includes("/milestones?")) return JSON.stringify(milestones.map((title) => ({ title })));
    if (a === "project" && b === "list") return JSON.stringify({ projects });
    if (a === "project" && b === "create") return JSON.stringify({ number: 7 });
    if (a === "project" && b === "field-list") return JSON.stringify({ fields: fields.map((name) => ({ name })) });
    return "";
  };
  return { gh, calls, writes: () => calls.filter(isWrite) };
}

test("area labels come from the sections, and the tiers from the order page", () => {
  const root = makeDocs();
  assert.deepEqual(areaLabels(root).map((label) => label.name), ["product", "editor", "docs"]);
  assert.equal(areaLabels(root)[1].description, "Documentation section 02: Title of 02-the-editor");
  assert.deepEqual(readTiers(root), [
    { title: "1 Bugs and usability", description: "things that are broken." },
    { title: "2 Finish what is half built", description: "before anything new." },
    { title: "3 Later", description: "Everything else." },
  ]);
});

test("a dry run reads the repository and changes nothing", () => {
  const fake = fakeGh();
  const lines = setupGithub({ root: makeDocs(), argv: ["--dry-run"], gh: fake.gh });
  assert.deepEqual(fake.writes(), []);
  assert.match(lines[0], /priya\/my-app\. Dry run: nothing was changed\./);
  assert.match(lines[1], /^Labels: 13 to add \(bug, feature, idea, decision, cleanup, research, from-owner, from-agent, from-user, triage, product, editor, docs\)/);
  assert.match(lines[2], /^Milestones: 3 to add \(1 Bugs and usability, 2 Finish what is half built, 3 Later\)/);
});

test("a real run adds only what is missing, leaves the rest alone and reports GitHub's starter labels", () => {
  const fake = fakeGh({ labels: ["Bug", "enhancement", "good first issue", "editor"], milestones: ["1 Bugs and usability"] });
  const lines = setupGithub({ root: makeDocs(), argv: [], gh: fake.gh });
  const created = fake.writes().filter((args) => args[0] === "label").map((args) => args[2]);
  assert.equal(created.length, 11);
  assert.ok(!created.includes("bug") && !created.includes("editor"));
  assert.deepEqual(fake.writes().find((args) => args[2] === "from-owner"), ["label", "create", "from-owner", "--repo", "priya/my-app", "--color", "000000", "--description", "Asked for by the owner"]);
  const milestones = fake.writes().filter((args) => args[0] === "api");
  assert.deepEqual(milestones.map((args) => args.at(-3)), ["title=2 Finish what is half built", "title=3 Later"]);
  assert.deepEqual(milestones[0].slice(0, 4), ["api", "--method", "POST", "repos/priya/my-app/milestones"]);
  assert.match(lines[1], /2 already there, left as they are \(bug, editor\)/);
  assert.match(lines.at(-1), /starter labels are still on the repository: enhancement, good first issue/);
  assert.ok(fake.calls.every((args) => !["delete", "edit"].includes(args[1])));
});

test("the board is made once, linked, and given its Workstream field; an existing one is reused", () => {
  const fresh = fakeGh();
  const lines = setupGithub({ root: makeDocs(), argv: ["--board", "--workstreams", "Editor, Sync"], gh: fresh.gh });
  assert.deepEqual(fresh.writes().filter((args) => args[0] === "project"), [
    ["project", "create", "--owner", "priya", "--title", "My App work", "--format", "json"],
    ["project", "link", "7", "--owner", "priya", "--repo", "my-app"],
    ["project", "field-create", "7", "--owner", "priya", "--name", "Workstream", "--data-type", "SINGLE_SELECT", "--single-select-options", "Editor,Sync"],
  ]);
  assert.match(lines.join("\n"), /made "My App work", number 7[\s\S]*added the Workstream field with 2 choices/);

  const again = fakeGh({ projects: [{ number: 3, title: "My App work" }], fields: ["Workstream"] });
  const second = setupGithub({ root: makeDocs(), argv: ["--board", "--workstreams", "Editor"], gh: again.gh });
  assert.ok(!again.writes().some((args) => args[1] === "create" && args[0] === "project"));
  assert.ok(!again.writes().some((args) => args[1] === "field-create"));
  assert.match(second.join("\n"), /already exists as number 3[\s\S]*Workstream field is already there/);
});

test("it stops with a plain reason when something is missing or wrong", () => {
  assert.throws(() => setupGithub({ root: makeDocs(), argv: [], gh: fakeGh({ signedIn: false }).gh }), /not signed in[\s\S]*gh auth login/);
  const noRepo = makeDocs();
  writeFileSync(join(noRepo, "docs.config.json"), JSON.stringify({ codeRepo: "../x", codeRef: "main" }));
  assert.throws(() => setupGithub({ root: noRepo, argv: [], gh: fakeGh().gh }), /does not name the repository on GitHub/);
  assert.throws(() => areaLabels(makeDocs({ chapters: ["01-the-product", "02-bug"] })), /area label "bug", which the issues rule already uses/);
  assert.throws(() => areaLabels(makeDocs({ chapters: ["02-the-editor", "05-editor"] })), /would both make the area label "editor"/);
  const noTiers = makeDocs();
  writeFileSync(join(noTiers, "work/order.md"), "# The order\n\n## The tiers\n\nNone yet.\n");
  assert.throws(() => readTiers(noTiers), /lists no tiers/);
  assert.throws(() => parseOptions(["--workstreams", "A"]), /add --board/);
  assert.throws(() => parseOptions(["--delete-everything"]), /unexpected argument/);
});

test("every fixed label fits GitHub's limits", () => {
  for (const label of FIXED_LABELS) {
    assert.match(label.color, /^[0-9a-f]{6}$/);
    assert.ok(label.description.length <= 100, label.name);
  }
});
