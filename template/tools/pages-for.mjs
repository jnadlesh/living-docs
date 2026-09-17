#!/usr/bin/env node
// Answers: "I changed these files. Which pages do I have to update?"
//   node tools/pages-for.mjs main~3..main        the files a range of commits changed
//   node tools/pages-for.mjs --files a.ts b.ts   files you name yourself
// Run it when you finish code work, before you say you are done.

import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { changedFiles, loadConfig } from "./lib/code-repo.mjs";
import { pagesForFiles, readAllPages } from "./lib/pages.mjs";

const FILES_SHOWN = 6;

export function report(root, files) {
  const all = pagesForFiles(readAllPages(root), files);
  const hits = all.filter((hit) => !hit.overview);
  const overview = all.filter((hit) => hit.overview);
  const covered = new Set(hits.flatMap((hit) => hit.matched));
  const uncovered = files.filter((file) => !covered.has(file));
  const lines = [`${files.length} changed files. ${hits.length} pages name them.`, ""];
  for (const { page, matched } of hits) {
    const shown = matched.slice(0, FILES_SHOWN).join(", ");
    const more = matched.length > FILES_SHOWN ? ` and ${matched.length - FILES_SHOWN} more` : "";
    lines.push(`${page.file}  (${page.title})`, `    because of: ${shown}${more}`);
  }
  if (overview.length > 0) {
    lines.push("", `Overview pages that cover these folders as a whole. Read them only if the big picture changed: ${overview.map((hit) => hit.page.title).join(", ")}.`);
  }
  if (uncovered.length > 0) {
    lines.push("", `${uncovered.length} changed files are on no page. If they hold something new, it needs a page:`);
    lines.push(...uncovered.slice(0, 20).map((file) => `    ${file}`));
    if (uncovered.length > 20) lines.push(`    and ${uncovered.length - 20} more`);
  }
  return lines.join("\n");
}

function main() {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const args = process.argv.slice(2);
  if (args.length === 0) throw new Error("give a commit range such as main~3..main, or --files followed by file paths");
  const files = args[0] === "--files" ? args.slice(1) : changedFiles(loadConfig(root).codeRepo, args[0]);
  process.stdout.write(`${report(root, files.map((file) => file.replaceAll("\\", "/")))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (cause) {
    process.stderr.write(`${cause.message}\n`);
    process.exitCode = 1;
  }
}
