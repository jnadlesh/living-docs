// The shape of the documentation repository. Every tool reads its rules from here,
// so a rule is stated once.

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const PAGE_HEADINGS = Object.freeze([
  "What it is",
  "How it works",
  "Where it lives",
  "Related",
  "Decisions",
  "Last checked",
]);

/** The five headings of NOW.md. The second one names the person who owns the project. */
export const nowHeadings = (owner) =>
  Object.freeze(["In flight", `Waiting on ${owner}`, "Next up", "Parked", "Watch out"]);

export const TASK_HEADINGS = Object.freeze([
  "What you asked for",
  "What done looks like",
  "Notes",
  "Status",
]);

export const TASK_STATUSES = Object.freeze(["in progress", "blocked", "done"]);

export const LIMITS = Object.freeze({
  pageLines: 150,
  nowLines: 60,
  inFlightDays: 7,
  lastCheckedDays: 90,
});

export const CHAPTER_DIR = /^\d\d-[a-z0-9-]+$/;
export const CHAPTER_INTRO = "README.md";
export const DOCS_DIR = "docs";
export const RULES_DIR = "rules";
export const WORK_DIR = "work";
export const DECISIONS_DIR = "decisions";
export const DECISION_FILE = /^(\d{4})-[a-z0-9-]+\.md$/;

const isDirectory = (path) => statSync(path).isDirectory();

/** The numbered chapter folders under docs/, in reading order. */
export function listChapters(root) {
  const docs = join(root, DOCS_DIR);
  return readdirSync(docs)
    .filter((name) => CHAPTER_DIR.test(name) && isDirectory(join(docs, name)))
    .sort();
}

/** The pages of one chapter: every Markdown file except the chapter intro. */
export function listPages(root, chapter) {
  const dir = join(root, DOCS_DIR, chapter);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md") && name !== CHAPTER_INTRO)
    .sort();
}

/** Markdown files directly inside one folder, or none when the folder is absent. */
export function listMarkdown(root, folder) {
  const dir = join(root, folder);
  try {
    return readdirSync(dir).filter((name) => name.endsWith(".md")).sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}
