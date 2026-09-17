#!/usr/bin/env node
// Sets up a living documentation repository beside a code repository.
//
//   node setup.mjs --project "My App" --owner "Priya" --code ../my-app --docs ../my-app-docs
//                  [--ref main] [--root ..] [--no-pointer] [--no-git]
//
// It copies the template, fills in the names, points the check at the code, and leaves
// short pointer files so every agent that opens the code or the root finds the documentation.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, "template");
const POINTERS = join(HERE, "pointers");
const BLOCK_START = "<!-- living-docs:start -->";
const BLOCK_END = "<!-- living-docs:end -->";
const TEXT_FILE = /\.(md|json|mjs|gitattributes)$|^\.gitattributes$/;

export function parseArgs(argv) {
  const options = { ref: "main", pointer: true, git: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--no-pointer") options.pointer = false;
    else if (arg === "--no-git") options.git = false;
    else if (arg.startsWith("--") && i + 1 < argv.length) options[arg.slice(2)] = argv[(i += 1)];
    else throw new Error(`unexpected argument: ${arg}`);
  }
  for (const name of ["project", "owner", "code", "docs"]) {
    if (typeof options[name] !== "string" || options[name].trim().length === 0) {
      throw new Error(`--${name} is required. See the top of setup.mjs for usage.`);
    }
  }
  if (!/^[\w./-]+$/.test(options.ref) || options.ref.startsWith("-")) throw new Error("--ref must be a plain branch name");
  return options;
}

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const toPosix = (path) => path.replaceAll("\\", "/");

function blanks(options, docs, code) {
  return {
    "{{PROJECT}}": options.project.trim(),
    "{{OWNER}}": options.owner.trim(),
    "{{PACKAGE}}": slug(options.project),
    "{{TODAY}}": new Date().toISOString().slice(0, 10),
    "{{CODE_REPO}}": toPosix(relative(docs, code)) || ".",
    "{{CODE_REF}}": options.ref,
    "{{DOCS_FROM_CODE}}": toPosix(relative(code, docs)),
    "{{DOCS_NAME}}": toPosix(relative(dirname(docs), docs)),
    "{{CODE_NAME}}": toPosix(relative(dirname(code), code)),
  };
}

const fill = (text, values) => Object.entries(values).reduce((out, [key, value]) => out.replaceAll(key, value), text);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function copyTemplate(docs, values) {
  cpSync(TEMPLATE, docs, { recursive: true });
  for (const file of walk(docs)) {
    if (!TEXT_FILE.test(file) || file.includes(`${join("tools", "test")}`)) continue;
    writeFileSync(file, fill(readFileSync(file, "utf8"), values));
  }
}

/** Adds or refreshes a marked block at the top of a file, leaving the rest of the file alone. */
export function withBlock(existing, block) {
  const wrapped = `${BLOCK_START}\n${block.trim()}\n${BLOCK_END}\n`;
  const from = existing.indexOf(BLOCK_START);
  const to = existing.indexOf(BLOCK_END);
  if (from !== -1 && to > from) return `${existing.slice(0, from)}${wrapped}${existing.slice(to + BLOCK_END.length).replace(/^\n/, "")}`;
  return existing.trim().length === 0 ? wrapped : `${wrapped}\n${existing}`;
}

function writePointer(folder, templateName, values) {
  const block = fill(readFileSync(join(POINTERS, templateName), "utf8"), values);
  const agents = join(folder, "AGENTS.md");
  writeFileSync(agents, withBlock(existsSync(agents) ? readFileSync(agents, "utf8") : "", block));
  const claude = join(folder, "CLAUDE.md");
  if (!existsSync(claude)) writeFileSync(claude, "@AGENTS.md\n");
  else if (!readFileSync(claude, "utf8").includes("@AGENTS.md")) return `${claude} exists and does not import AGENTS.md. Add the line @AGENTS.md to it.`;
  return null;
}

function run(cwd, command, args) {
  return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function startGit(docs) {
  if (existsSync(join(docs, ".git"))) return;
  run(docs, "git", ["init", "-q", "-b", "main"]);
  run(docs, "git", ["add", "-A"]);
  run(docs, "git", ["commit", "-q", "-m", "docs: set up the documentation repository"]);
}

export function setup(argv) {
  const options = parseArgs(argv);
  const docs = resolve(options.docs);
  const code = resolve(options.code);
  if (!existsSync(code)) throw new Error(`the code repository was not found at ${code}`);
  if (existsSync(docs) && readdirSync(docs).length > 0) throw new Error(`${docs} already exists and is not empty. Nothing was changed.`);
  const values = blanks(options, docs, code);
  mkdirSync(docs, { recursive: true });
  copyTemplate(docs, values);
  run(docs, process.execPath, ["tools/build-indexes.mjs"]);
  const notes = [];
  if (options.pointer) notes.push(writePointer(code, "code-AGENTS.md", values));
  if (options.root) notes.push(writePointer(resolve(options.root), "root-AGENTS.md", values));
  if (options.git) startGit(docs);
  const checked = run(docs, process.execPath, ["tools/check.mjs"]).trim().split("\n").at(-1);
  return { docs, code, checked, notes: notes.filter(Boolean) };
}

function main() {
  try {
    const result = setup(process.argv.slice(2));
    const lines = [
      `Documentation repository ready at ${result.docs}`,
      `Its check says: ${result.checked}`,
      ...result.notes.map((note) => `Note: ${note}`),
      "Next: open NOW.md there. It lists the first two things to do.",
    ];
    process.stdout.write(`${lines.join("\n")}\n`);
  } catch (cause) {
    process.stderr.write(`Setup stopped. ${cause.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
