#!/usr/bin/env node
// Looks something up in one step:  node tools/find.mjs island
// Prints the best matching pages, what each thing is, and where it lives in the code.

import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findPages, readAllPages } from "./lib/pages.mjs";

const RESULTS = 6;
const PATHS_SHOWN = 4;

export function report(root, query) {
  const hits = findPages(readAllPages(root), query).slice(0, RESULTS);
  if (hits.length === 0) return `No page matches "${query}". If it exists in the code, it has no page yet. If you are about to build it, it is new.`;
  return hits
    .map(({ page }) => {
      const paths = page.paths.slice(0, PATHS_SHOWN).join(", ") + (page.paths.length > PATHS_SHOWN ? ", ..." : "");
      return `${page.title}  (${page.file})\n    ${page.summary}\n    lives in: ${paths}`;
    })
    .join("\n\n");
}

function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (query.length === 0) throw new Error("say what you are looking for, for example: node tools/find.mjs island");
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  process.stdout.write(`${report(root, query)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (cause) {
    process.stderr.write(`${cause.message}\n`);
    process.exitCode = 1;
  }
}
