#!/usr/bin/env node
// Checks the documentation against its own rules and against the code it describes.
// Errors fail the run. Warnings are questions for whoever is working next.
//   --no-code   skip the check that listed paths exist in the code repository
// A repository set up with --design-first skips the code by itself, and says so, until the
// code exists; then it warns until setup's --connect has joined the two.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { staleIndexes } from "./build-indexes.mjs";
import { checkDecision, checkDrift, checkUniqueTitles, checkLength, checkLinks, checkNow, checkPage, checkRetiredWords, localToday, parseRetiredWords } from "./lib/checks.mjs";
import { CONFIG_FILE, codeIsReady, commitsSince, loadConfig, trackedPaths } from "./lib/code-repo.mjs";
import { readAllPages, specificPaths } from "./lib/pages.mjs";
import { DECISIONS_DIR, DECISION_FILE, DOCS_DIR, LIMITS, REFERENCE_DIR, RULES_DIR, WORK_DIR, listChapters, listMarkdown, listMarkdownDeep, listPages } from "./lib/layout.mjs";

const NOW_FILE = "NOW.md";
const RETIRED_WORDS_FILE = `${RULES_DIR}/docs/retired-words.md`;
const TOP_FILES = Object.freeze(["README.md", NOW_FILE]);

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

/** Pages whose code changed after they were last checked. Warnings, never errors. */
function checkAllDrift(root, config, tracked) {
  const countCommits = (paths, day) =>
    commitsSince(config.codeRepo, config.codeRef, paths.filter((path) => tracked.has(path)), day);
  return readAllPages(root).flatMap((page) =>
    checkDrift({ file: page.file, paths: specificPaths(page), lastChecked: page.lastChecked, countCommits }),
  );
}

/** Every rules page, in every subject folder under rules/. */
const ruleFiles = (root) => listMarkdownDeep(root, RULES_DIR).map((name) => `${RULES_DIR}/${name}`);

function checkRules(root) {
  return ruleFiles(root).flatMap((file) => {
    const text = read(root, file);
    return [...checkLength(file, text, LIMITS.pageLines), ...checkLinks(root, file, text)];
  });
}

/**
 * Broken links anywhere under work/ and reference/, as warnings. Plans and references are
 * read by the next agent, so a dead link there is a real cost, but older plans were written
 * before the documents moved and knowingly point at old places, so it is not an error.
 */
function checkWorkingLinks(root) {
  return [WORK_DIR, REFERENCE_DIR].flatMap((folder) =>
    listMarkdownDeep(root, folder).flatMap((name) => {
      const file = `${folder}/${name}`;
      return checkLinks(root, file, read(root, file)).map((problem) => ({ ...problem, level: "warning" }));
    }),
  );
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
    ...ruleFiles(root),
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

/** True while a documentation repository set up before its code is still waiting for it. */
export const codeIsWaiting = (config) => config.designFirst && !codeIsReady(config.codeRepo, config.codeRef);

/** Once the code a design-first repository waited for exists, joining the two is due. */
function connectReminder(config, waiting) {
  if (!config.designFirst || waiting) return [];
  return [{
    level: "warning",
    file: CONFIG_FILE,
    message: `the code exists now at ${config.codeRepo}. Connect it: run the living-docs skill's setup with --connect and --docs pointing at this repository`,
  }];
}

/** Runs every check and returns the problems found. */
export function runChecks({ root, today, useCode }) {
  const config = loadConfig(root);
  const waiting = codeIsWaiting(config);
  const tracked = useCode && !waiting ? trackedPaths(config.codeRepo, config.codeRef) : null;
  return [
    ...checkPages(root, tracked, today),
    ...checkUniqueTitles(readAllPages(root)),
    ...(tracked ? checkAllDrift(root, config, tracked) : []),
    ...connectReminder(config, waiting),
    ...checkRules(root),
    ...checkNow({ file: NOW_FILE, text: read(root, NOW_FILE), today }),
    ...checkWorkingLinks(root),
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
  if (useCode && codeIsWaiting(loadConfig(root))) {
    process.stdout.write("The code does not exist yet, so code paths and drift were not checked.\n");
  }
  const errors = report(runChecks({ root, today: localToday(), useCode }));
  if (errors > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
