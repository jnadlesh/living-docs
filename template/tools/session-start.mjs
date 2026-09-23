#!/usr/bin/env node
// Prints where the work is today, for a harness to load at the start of a session.
// Wired as a Claude Code SessionStart hook, whose output is added to the session's context.
// It never fails a session: if anything is missing it says so in one line and exits cleanly.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./lib/code-repo.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

/** Where the work is tracked, when the configuration names the repository on GitHub. */
function issuesLine() {
  try {
    const { github } = loadConfig(root);
    if (github === null) return [];
    return [`All work is a GitHub issue on ${github}: https://github.com/${github}/issues. How an issue is written and worked is in rules/code/issues.md.`];
  } catch (cause) {
    return [`docs.config.json could not be read, so the issues line is missing: ${cause.message}`];
  }
}

function main() {
  const now = readFileSync(resolve(root, "NOW.md"), "utf8").replace(/\r\n/g, "\n").trim();
  const lines = [
    `Loaded from the documentation repository at ${root.replaceAll("\\", "/")}. It is the single source of truth for this project.`,
    "",
    now,
    "",
    "Before you build anything, look it up: node tools/find.mjs <words>, run from that repository, or open TABLE-OF-CONTENTS.md.",
    "No work is done until the documentation is updated: node tools/pages-for.mjs <commit range> lists the pages your change touches.",
    ...issuesLine(),
    "The rules are in rules/: start with rules/README.md, rules/how-we-build.md and rules/working-with-the-owner.md.",
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

try {
  main();
} catch (cause) {
  process.stdout.write(`The documentation repository could not be read at ${root}: ${cause.message}\n`);
}
