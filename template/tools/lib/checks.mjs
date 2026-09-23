// The checks. Each takes text and returns a list of problems; none of them touches the
// disk except through the small readers passed in, so every rule can be tested alone.

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { isPlainRepoPath } from "./code-repo.mjs";
import { DECISION_FILE, LIMITS, PAGE_HEADINGS, NOW_HEADINGS } from "./layout.mjs";
import { listedPaths, parsePage, proseOnly, relativeLinks, sectionBody, withoutFences } from "./markdown.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATED_ITEM = /^(?:[-*] |\d+\. )(\S+)/;
const LIST_ITEM = /^(?:[-*] |\d+\. )/;
const TRAILING_PUNCTUATION = /[:;,.]+$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const error = (file, message) => ({ level: "error", file, message });
const warning = (file, message) => ({ level: "warning", file, message });

/** A real calendar date written as YYYY-MM-DD, or null. */
export function parseDate(value) {
  if (!DATE.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

/**
 * Today as the calendar day where the check runs, the date a person there would write.
 * Midnight UTC of the local day, so it compares exactly with a date from parseDate. Using
 * the moment itself would call today's date "in the future" wherever the clock is ahead of UTC.
 */
export function localToday(now = new Date()) {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** A day written the way the documentation writes dates: 2026-09-17. */
export const formatDate = (date) => date.toISOString().slice(0, 10);

const ageInDays = (date, today) => Math.floor((today.getTime() - date.getTime()) / DAY_MS);

const lineCount = (text) => text.replace(/\n+$/, "").split("\n").length;

function headingProblems(file, page, expected) {
  const found = page.sections.map((s) => s.heading);
  if (found.length === expected.length && found.every((h, i) => h === expected[i])) return [];
  return [error(file, `headings must be exactly: ${expected.join(", ")}. Found: ${found.join(", ") || "none"}`)];
}

export function checkLength(file, text, cap) {
  const lines = lineCount(text);
  return lines > cap ? [error(file, `${lines} lines, the cap is ${cap}. Split the page.`)] : [];
}

/** Every relative link must reach a file that exists. */
export function checkLinks(root, file, text) {
  return relativeLinks(text)
    .filter((target) => !linkResolves(root, file, target))
    .map((target) => error(file, `broken link: ${target}`));
}

function linkResolves(root, file, target) {
  try {
    return existsSync(join(root, dirname(file), decodeURIComponent(target)));
  } catch (cause) {
    if (cause instanceof URIError) return false;
    throw cause;
  }
}

function lastCheckedProblems(file, body, today) {
  const date = parseDate((body ?? "").split("\n")[0].trim());
  if (!date) return [error(file, "Last checked must be a date written as YYYY-MM-DD")];
  if (date > today) return [error(file, "Last checked is in the future")];
  const age = ageInDays(date, today);
  if (age <= LIMITS.lastCheckedDays) return [];
  return [warning(file, `last checked ${age} days ago. Check it against the code.`)];
}

function pathProblems(file, body, tracked) {
  const paths = listedPaths(body ?? "").map((p) => p.replace(/\/$/, ""));
  if (paths.length === 0) return [error(file, "Where it lives must list at least one path in backticks")];
  return paths.flatMap((path) => {
    if (!isPlainRepoPath(path)) return [error(file, `write the path from the repository root: ${path}`)];
    if (tracked && !tracked.has(path)) return [error(file, `path not found in the code: ${path}`)];
    return [];
  });
}

/** One page under docs/: shape, length, paths, date and links. */
export function checkPage({ root, file, text, tracked, today }) {
  const page = parsePage(text);
  const what = sectionBody(page, "What it is");
  return [
    ...(page.title ? [] : [error(file, "the page needs one # title")]),
    ...headingProblems(file, page, PAGE_HEADINGS),
    ...(what !== null && what.length === 0 ? [error(file, "What it is cannot be empty")] : []),
    ...checkLength(file, text, LIMITS.pageLines),
    ...pathProblems(file, sectionBody(page, "Where it lives"), tracked),
    ...lastCheckedProblems(file, sectionBody(page, "Last checked"), today),
    ...checkLinks(root, file, text),
  ];
}

function nowItemProblems(file, section, today) {
  const items = section.body.split("\n").filter((line) => LIST_ITEM.test(line));
  return items.flatMap((line) => {
    const token = (DATED_ITEM.exec(line)?.[1] ?? "").replace(TRAILING_PUNCTUATION, "");
    const date = parseDate(token);
    if (!date) return [error(file, `start the line with a real date: ${line.slice(0, 60)}`)];
    const old = section.heading === "In flight" && ageInDays(date, today) > LIMITS.inFlightDays;
    return old ? [warning(file, `in flight for over ${LIMITS.inFlightDays} days, is it still true? ${line.slice(0, 60)}`)] : [];
  });
}

/** NOW.md: one screen, five headings, every line dated. */
export function checkNow({ file, text, today }) {
  const page = parsePage(text);
  const updated = /^Updated: (\S+?),? by .+$/m.exec(withoutFences(text));
  return [
    ...(updated && parseDate(updated[1]) ? [] : [error(file, 'needs a line like "Updated: 2026-09-17, by Claude"')]),
    ...headingProblems(file, page, NOW_HEADINGS),
    ...checkLength(file, text, LIMITS.nowLines),
    ...page.sections.flatMap((section) => nowItemProblems(file, section, today)),
  ];
}

/** Rows of the retired-words table: the word nobody writes any more, and its replacement. */
export function parseRetiredWords(text) {
  return withoutFences(text)
    .split("\n")
    .filter((line) => line.startsWith("|") && !/^\|\s*-/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 2 && cells[0].toLowerCase() !== "do not write")
    .map(([retired, current]) => ({ retired, current }));
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A retired word anywhere in a live document is an error: one word per thing. */
export function checkRetiredWords(file, text, words) {
  const prose = proseOnly(text);
  return words
    .filter(({ retired }) => new RegExp(`\\b${escapeRegExp(retired)}s?\\b`, "i").test(prose))
    .map(({ retired, current }) => error(file, `"${retired}" is retired. Write "${current}".`));
}

const STATUS_LINE = /^Status: (.+)$/m;
const STATUS_REFERENCE = /\[(\d{4})\]\(([^)]+)\)/g;
const STATUS_FORMS = [/^proposed$/, /^accepted$/, /^accepted, amended by .+$/, /^superseded by .+$/, /^withdrawn$/];

/** The status of a decision record, as plain text and the decisions it points at. */
export function readDecisionStatus(text) {
  const line = STATUS_LINE.exec(withoutFences(text))?.[1].trim() ?? null;
  if (line === null) return null;
  const references = [...line.matchAll(STATUS_REFERENCE)].map((m) => ({ number: m[1], file: m[2] }));
  return { line, plain: line.replace(STATUS_REFERENCE, "$1"), references };
}

/** A decision record: numbered name, matching title, a known status, and real targets. */
export function checkDecision({ file, name, text, known }) {
  const number = DECISION_FILE.exec(name)?.[1];
  if (!number) return [error(file, "name a decision like 0042-short-title.md")];
  const title = parsePage(text).title ?? "";
  const status = readDecisionStatus(text);
  const form = status && STATUS_FORMS.some((pattern) => pattern.test(status.plain));
  const needsTarget = status && /amended by|superseded by/.test(status.plain);
  return [
    ...(title.startsWith(`${number} `) ? [] : [error(file, `the title must start with its number: # ${number} ...`)]),
    ...(form ? [] : [error(file, 'needs a line like "Status: accepted" or "Status: superseded by [0042](0042-title.md)"')]),
    ...(needsTarget && status.references.length === 0 ? [error(file, "the status must link the decision it names")] : []),
    ...(status?.references ?? [])
      .filter((ref) => known.get(ref.number) !== ref.file)
      .map((ref) => error(file, `the status links ${ref.number} as ${ref.file}, which is not a decision here`)),
  ];
}

/** A page whose files changed after it was last checked may no longer be true. */
export function checkDrift({ file, paths, lastChecked, countCommits }) {
  if (!parseDate(lastChecked) || paths.length === 0) return [];
  const commits = countCommits(paths.filter(isPlainRepoPath), lastChecked);
  if (commits === 0) return [];
  const times = commits === 1 ? "1 commit has" : `${commits} commits have`;
  return [warning(file, `${times} changed its files since it was last checked on ${lastChecked}. Read it against the code, fix it, and set Last checked to today.`)];
}

/** Two pages with one title would be one glossary term with two meanings. */
export function checkUniqueTitles(pages) {
  const seen = new Map();
  return pages.flatMap((page) => {
    const key = page.title.trim().toLowerCase();
    const first = seen.get(key);
    if (first === undefined) {
      seen.set(key, page.file);
      return [];
    }
    return [error(page.file, `its title "${page.title}" is already used by ${first}. One word per thing: rename one of them.`)];
  });
}
