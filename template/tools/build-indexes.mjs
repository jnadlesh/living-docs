#!/usr/bin/env node
// Builds the three indexes from the pages, so nobody maintains them by hand:
//   each chapter intro's page list, TABLE-OF-CONTENTS.md, and GLOSSARY.md.
// Run with --check to fail when an index is out of date instead of writing it.

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readDecisionStatus } from "./lib/checks.mjs";
import { CHAPTER_INTRO, DECISIONS_DIR, DECISION_FILE, DOCS_DIR, listChapters, listMarkdown, listPages } from "./lib/layout.mjs";
import { firstSentences, listedPaths, parsePage, replaceBlock, sectionBody } from "./lib/markdown.mjs";

export const TOC_FILE = "TABLE-OF-CONTENTS.md";
export const GLOSSARY_FILE = "GLOSSARY.md";
export const DECISIONS_INDEX = `${DECISIONS_DIR}/README.md`;
const BLOCK_START = "<!-- generated:";
const PATHS_SHOWN = 3;

const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

/** The hand-written head of a chapter intro: its title and what the chapter covers. */
function chapterHead(text) {
  const page = parsePage(text.split(BLOCK_START)[0]);
  const prose = text.split(BLOCK_START)[0].split("\n").filter((l) => !l.startsWith("# ")).join(" ");
  return { title: page.title ?? "", blurb: firstSentences(prose, 1) };
}

function readPage(root, chapter, file) {
  const page = parsePage(read(join(root, DOCS_DIR, chapter, file)));
  const what = sectionBody(page, "What it is") ?? "";
  return {
    file,
    title: page.title ?? file,
    summary: firstSentences(what, 1),
    definition: firstSentences(what, 2),
    paths: listedPaths(sectionBody(page, "Where it lives") ?? ""),
  };
}

/** Everything the indexes need to know about one chapter. */
export function readChapter(root, chapter) {
  const head = chapterHead(read(join(root, DOCS_DIR, chapter, CHAPTER_INTRO)));
  const pages = listPages(root, chapter).map((file) => readPage(root, chapter, file));
  return { chapter, ...head, pages };
}

const cell = (text) => text.replaceAll("|", "\\|");

/** The first few code paths a page names, and how many more there are. */
function livesIn(paths) {
  const shown = paths.slice(0, PATHS_SHOWN).map((path) => `\`${path}\``).join(", ");
  const rest = paths.length - PATHS_SHOWN;
  return rest > 0 ? `${shown} and ${rest} more` : shown;
}

/** The table of contents of one section: every page, what it is, and where it lives. */
export function renderPagesBlock(chapter) {
  if (chapter.pages.length === 0) return "No pages yet.";
  const rows = chapter.pages.map(
    (p) => `| [${cell(p.title)}](${p.file}) | ${cell(p.summary)} | ${livesIn(p.paths)} |`,
  );
  return ["| Page | What it is | Where it lives in the code |", "|---|---|---|", ...rows].join("\n");
}

export function renderChaptersBlock(chapters) {
  return chapters
    .map((c) => {
      const count = c.pages.length === 1 ? "1 page" : `${c.pages.length} pages`;
      const link = `${DOCS_DIR}/${c.chapter}/${CHAPTER_INTRO}`;
      return `- [${c.chapter.slice(0, 2)} ${c.title}](${link}): ${c.blurb} ${count}.`;
    })
    .join("\n");
}

export function renderGlossaryBlock(chapters) {
  const entries = chapters.flatMap((c) =>
    c.pages.map((p) => ({ ...p, link: `${DOCS_DIR}/${c.chapter}/${p.file}` })),
  );
  if (entries.length === 0) return "No terms yet.";
  return entries
    .toSorted((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }))
    .map((e) => `**${e.title}**: ${e.definition} [Read the page](${e.link}).`)
    .join("\n\n");
}

/** Every decision record: its number, title and status. */
export function readDecisions(root) {
  return listMarkdown(root, DECISIONS_DIR)
    .filter((name) => DECISION_FILE.test(name))
    .map((name) => {
      const text = read(join(root, DECISIONS_DIR, name));
      const title = (parsePage(text).title ?? name).replace(/^\d{4}\s*[\u2014-]\s*/, "");
      return { name, number: name.slice(0, 4), title, status: readDecisionStatus(text)?.line ?? "no status" };
    });
}

export function renderDecisionsBlock(decisions) {
  if (decisions.length === 0) return "No decisions yet.";
  const rows = decisions.map((d) => `| [${d.number}](${d.name}) | ${d.title.replaceAll("|", "\\|")} | ${d.status} |`);
  return ["| Number | Decision | Status |", "|---|---|---|", ...rows].join("\n");
}

/** One file with its generated block rebuilt. A failure names the file it happened in. */
function rebuilt(root, path, name, content) {
  try {
    return replaceBlock(read(join(root, path)), name, content);
  } catch (cause) {
    throw new Error(`${path.replaceAll("\\", "/")}: ${cause.message}`, { cause });
  }
}

/** The full new text of every generated file, keyed by its path from the root. */
export function buildIndexes(root) {
  const chapters = listChapters(root).map((chapter) => readChapter(root, chapter));
  const outputs = new Map();
  for (const chapter of chapters) {
    const path = join(DOCS_DIR, chapter.chapter, CHAPTER_INTRO);
    outputs.set(path, rebuilt(root, path, "pages", renderPagesBlock(chapter)));
  }
  outputs.set(TOC_FILE, rebuilt(root, TOC_FILE, "chapters", renderChaptersBlock(chapters)));
  outputs.set(GLOSSARY_FILE, rebuilt(root, GLOSSARY_FILE, "glossary", renderGlossaryBlock(chapters)));
  outputs.set(DECISIONS_INDEX, rebuilt(root, DECISIONS_INDEX, "decisions", renderDecisionsBlock(readDecisions(root))));
  return outputs;
}

/** The generated files whose text on disk differs from what the pages produce. */
export function staleIndexes(root) {
  return [...buildIndexes(root)]
    .filter(([path, text]) => read(join(root, path)) !== text)
    .map(([path]) => path.replaceAll("\\", "/"));
}

function main() {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  if (process.argv.includes("--check")) {
    const stale = staleIndexes(root);
    if (stale.length === 0) return;
    process.stderr.write(`Out of date, run "npm run build":\n${stale.map((p) => `  ${p}`).join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  const outputs = buildIndexes(root);
  for (const [path, text] of outputs) writeFileSync(join(root, path), text);
  process.stdout.write(`Built ${outputs.size} index files.\n`);
}

function run() {
  try {
    main();
  } catch (cause) {
    process.stderr.write(`Could not build the indexes. ${cause.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();
