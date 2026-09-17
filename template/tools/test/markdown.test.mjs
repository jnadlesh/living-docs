import assert from "node:assert/strict";
import { test } from "node:test";
import {
  firstSentences,
  listedPaths,
  parsePage,
  relativeLinks,
  replaceBlock,
  sectionBody,
} from "../lib/markdown.mjs";

test("a page splits into its title and sections in order", () => {
  const page = parsePage("# The island\n\n## What it is\n\nA pill.\n\n## How it works\n\n1. It shows.\n");
  assert.equal(page.title, "The island");
  assert.deepEqual(page.sections.map((s) => s.heading), ["What it is", "How it works"]);
  assert.equal(sectionBody(page, "What it is"), "A pill.");
  assert.equal(sectionBody(page, "Missing"), null);
});

test("headings inside a fenced block are not headings", () => {
  const page = parsePage("# T\n\n## What it is\n\n```\n## Not a heading\n```\n\n## How it works\n\nx\n");
  assert.deepEqual(page.sections.map((s) => s.heading), ["What it is", "How it works"]);
});

test("the first sentences come back on one line", () => {
  const text = "The island shows progress.\nIt sits above the composer. It can be hovered.";
  assert.equal(firstSentences(text, 2), "The island shows progress. It sits above the composer.");
  assert.equal(firstSentences("no full stop", 2), "no full stop");
});

test("only links into this repository are collected, without anchors", () => {
  const text = "[a](one.md) [b](https://x.test/y) [c](#top) [d](../two.md#part) [e](mailto:x@y.test)";
  assert.deepEqual(relativeLinks(text), ["one.md", "../two.md"]);
});

test("listed paths are the backticked entries of list items only", () => {
  const body = "Prose with `not/a/path`.\n- `packages/ui/src/island.tsx` the pill\n- `packages/ui` and `apps/aurelia`\n";
  assert.deepEqual(listedPaths(body), ["packages/ui/src/island.tsx", "packages/ui", "apps/aurelia"]);
});

test("a generated block is replaced and the hand-written text is kept", () => {
  const text = "# T\n\nIntro.\n\n<!-- generated:pages:start -->\nold\n<!-- generated:pages:end -->\n";
  const next = replaceBlock(text, "pages", "- new");
  assert.equal(next, "# T\n\nIntro.\n\n<!-- generated:pages:start -->\n- new\n<!-- generated:pages:end -->\n");
  assert.equal(replaceBlock(next, "pages", "- new"), next);
});

test("a missing generated block is an error, never a silent skip", () => {
  assert.throws(() => replaceBlock("# T\n", "pages", "x"), /missing generated block "pages"/);
});

test("a full stop inside a version or before a lowercase word does not end a sentence", () => {
  assert.equal(firstSentences("Version v1.2 is out now. It fixes bugs.", 1), "Version v1.2 is out now.");
  assert.equal(firstSentences("It handles odd input, e.g. edge cases. Next.", 1), "It handles odd input, e.g. edge cases.");
});

test("angle-bracket, titled and reference-style links are all collected", () => {
  const text = '[a](<my file.md>) [b](x.md "A title")\n\n[c][ref]\n\n[ref]: ../y.md\n';
  assert.deepEqual(relativeLinks(text), ["my file.md", "x.md", "../y.md"]);
});
