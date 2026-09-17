#!/usr/bin/env node
// Checks the documentation against its own rules and against the code it describes.
// Errors fail the run. Warnings are questions for whoever is working next.
//   --no-code   skip the check that listed paths exist in the code repository

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { staleIndexes } from "./build-indexes.mjs";
import { checkDecision, checkLength, checkLinks, checkNow, checkPage, checkRetiredWords, checkTask, parseRetiredWords } from "./lib/checks.mjs";
import { loadConfig, trackedPaths } from "./lib/code-repo.mjs";
import { DECISIONS_DIR, DECISION_FILE, DOCS_DIR, LIMITS, RULES_DIR, WORK_DIR, listChapters, listMarkdown, listPages } from "./lib/layout.mjs";

const NOW_FILE = "NOW.md";
const RETIRED_WORDS_FILE = `${RULES_DIR}/retired-words.md`;
const TOP_FILES = Object.freeze(["README.md", NOW_FILE]);
const TASK_EXEMPT = new Set(["README.md"]);

const read = (root, file) => readFileSync(join(root, file), "utf8").replace(/\r\n/g, "\n");

function pageFiles(root) {
  return listChapters(root).flatMap((chapter) =>
    listPages(root, chapter).map((page) => `${DOCS_DIR}/${chapter}/${page}`),
  );
}

function checkPages(root, tracked, today) {
  return pageFiles(root).flatMap((file) =>
    checkPage({ root, file, text: read(root, file), tracked, today }),
  );
}

function checkRules(root) {
  return listMarkdown(root, RULES_DIR).flatMap((name) => {
    const file = `${RULES_DIR}/${name}`;
    const text = read(root, file);
    return [...checkLength(file, text, LIMITS.pageLines), ...checkLinks(root, file, text)];
  });
}

function checkTasks(root) {
  return listMarkdown(root, WORK_DIR)
    .filter((name) => !TASK_EXEMPT.has(name))
    .flatMap((name) => checkTask({ file: `${WORK_DIR}/${name}`, text: read(root, `${WORK_DIR}/${name}`) }));
}

function checkDecisions(root) {
  const names = listMarkdown(root, DECISIONS_DIR).filter((name) => name !== "README.md");
  const known = new Map(names.filter((n) => DECISION_FILE.test(n)).map((n) => [n.slice(0, 4), n]));
  return names.flatMap((name) => {
    const file = `${DECISIONS_DIR}/${name}`;
    return checkDecision({ file, name, text: read(root, file), known });
  });
}

function checkWords(root) {
  const words = parseRetiredWords(read(root, RETIRED_WORDS_FILE));
  const live = [
    ...TOP_FILES,
    ...pageFiles(root),
    ...listMarkdown(root, RULES_DIR).map((name) => `${RULES_DIR}/${name}`),
  ].filter((file) => file !== RETIRED_WORDS_FILE);
  return live.flatMap((file) => checkRetiredWords(file, read(root, file), words));
}

/** Indexes that are out of date, or the reason they could not be built at all. */
function checkIndexes(root) {
  try {
    return staleIndexes(root).map((file) => ({ level: "error", file, message: 'out of date, run "npm run build"' }));
  } catch (cause) {
    return [{ level: "error", file: "indexes", message: cause.message }];
  }
}

/** Runs every check and returns the problems found. */
export function runChecks({ root, today, useCode }) {
  const config = loadConfig(root);
  const tracked = useCode ? trackedPaths(config.codeRepo, config.codeRef) : null;
  return [
    ...checkPages(root, tracked, today),
    ...checkRules(root),
    ...checkNow({ file: NOW_FILE, text: read(root, NOW_FILE), today, owner: config.owner }),
    ...checkTasks(root),
    ...checkDecisions(root),
    ...checkWords(root),
    ...TOP_FILES.flatMap((file) => checkLinks(root, file, read(root, file))),
    ...checkIndexes(root),
  ];
}

function report(problems) {
  const lines = problems.map((p) => `${p.level.toUpperCase().padEnd(7)} ${p.file}: ${p.message}`);
  const errors = problems.filter((p) => p.level === "error").length;
  const summary = `${errors} errors, ${problems.length - errors} warnings.`;
  process.stdout.write(`${[...lines, summary].join("\n")}\n`);
  return errors;
}

function main() {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const useCode = !process.argv.includes("--no-code");
  const errors = report(runChecks({ root, today: new Date(), useCode }));
  if (errors > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
