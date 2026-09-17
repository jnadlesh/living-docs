// Reads every page once, for the tools that answer questions about pages:
// which pages name a file, which pages match a word, which pages have drifted.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DOCS_DIR, listChapters, listPages } from "./layout.mjs";
import { firstSentences, listedPaths, parsePage, sectionBody } from "./markdown.mjs";

const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const trimSlash = (path) => path.replace(/\/$/, "");

/** Every page with its title, opening, code paths and last-checked date. */
export function readAllPages(root) {
  return listChapters(root).flatMap((chapter) =>
    listPages(root, chapter).map((name) => {
      const file = `${DOCS_DIR}/${chapter}/${name}`;
      const page = parsePage(read(join(root, file)));
      const what = sectionBody(page, "What it is") ?? "";
      return {
        file,
        title: page.title ?? name,
        summary: firstSentences(what, 1),
        what,
        paths: listedPaths(sectionBody(page, "Where it lives") ?? "").map(trimSlash),
        lastChecked: (sectionBody(page, "Last checked") ?? "").split("\n")[0].trim(),
      };
    }),
  );
}

/** True when a changed file is the listed path, or sits inside a listed folder. */
export const pathCovers = (listed, changed) => changed === listed || changed.startsWith(`${listed}/`);

/** The pages that name any of the changed files, each with the files that matched. */
export function pagesForFiles(pages, changedFiles) {
  return pages
    .map((page) => ({
      page,
      matched: changedFiles.filter((changed) => page.paths.some((listed) => pathCovers(listed, changed))),
    }))
    .filter((hit) => hit.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length);
}

const WORD = /[a-z0-9]+/g;
const words = (text) => text.toLowerCase().match(WORD) ?? [];

/** Pages ranked by how well they match the words asked for. Titles count most. */
export function findPages(pages, query) {
  const wanted = words(query);
  if (wanted.length === 0) return [];
  return pages
    .map((page) => {
      const title = words(page.title);
      const body = words(page.what);
      const paths = page.paths.join(" ").toLowerCase();
      const score = wanted.reduce((sum, word) => {
        const inTitle = title.some((t) => t.startsWith(word)) ? 10 : 0;
        const inBody = body.some((t) => t.startsWith(word)) ? 3 : 0;
        const inPaths = paths.includes(word) ? 2 : 0;
        return sum + inTitle + inBody + inPaths;
      }, 0);
      return { page, score };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title));
}
