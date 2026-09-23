#!/usr/bin/env node
// Sets up a living documentation repository beside a code repository, and the code
// repository's side of it: the pointer every agent reads, the issue forms and pull request
// template, and the hook that loads NOW.md when a Claude Code session starts.
//
//   node setup.mjs --project "My App" --owner "Priya" --code ../my-app --docs ../my-app-docs
//                  [--github owner/name] [--ref main] [--root ..] [--no-code-files] [--no-git]
//                  [--design-first]
//   node setup.mjs --connect --docs ../my-app-docs [--no-code-files]
//
// --design-first sets up the documentation before the code exists: --code names where the code
// will be, and --github the repository on GitHub that will hold the work. Once the code is a git
// repository with a first commit, --connect joins the two.
//
// It only adds. It refuses a documentation folder that already has files, never overwrites
// a file in the code repository, and changes nothing on GitHub: that is tools/github.mjs in
// the new repository, run once the owner agrees.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { formatDate, localToday } from "./template/tools/lib/checks.mjs";
import { CONFIG_FILE, GITHUB_REPO, codeIsReady, loadConfig } from "./template/tools/lib/code-repo.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, "template");
const POINTERS = join(HERE, "pointers");
const CODE_GITHUB = join(HERE, "code-github");
const BLOCK_START = "<!-- living-docs:start -->";
const BLOCK_END = "<!-- living-docs:end -->";
const TEXT_FILE = /\.(md|json|mjs|ya?ml|gitattributes)$|^\.gitattributes$/;
const VALUE_OPTIONS = new Set(["project", "owner", "code", "docs", "github", "ref", "root"]);
const MAIN_BRANCHES = ["main", "master"];
const NOW_FILE = "NOW.md";
const WATCH_OUT = "## Watch out";
/** The words that mark setup's own line in NOW.md while the code does not exist, so --connect can find it. */
const DESIGN_FIRST_MARK = "The code does not exist yet.";

/** One of the skill's own files, with Unix line endings however the skill was checked out. */
const readText = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

export function parseArgs(argv) {
  const options = { codeFiles: true, git: true, designFirst: false, connect: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const name = arg.slice(2);
    if (arg === "--no-code-files") options.codeFiles = false;
    else if (arg === "--no-git") options.git = false;
    else if (arg === "--design-first") options.designFirst = true;
    else if (arg === "--connect") options.connect = true;
    else if (arg.startsWith("--") && VALUE_OPTIONS.has(name) && i + 1 < argv.length) options[name] = argv[(i += 1)];
    else throw new Error(`unexpected argument: ${arg}. See the top of setup.mjs for usage.`);
  }
  const required = options.connect ? ["docs"] : ["project", "owner", "code", "docs"];
  for (const name of required) {
    if (typeof options[name] !== "string" || options[name].trim().length === 0) {
      throw new Error(`--${name} is required. See the top of setup.mjs for usage.`);
    }
  }
  if (options.connect) checkConnectArgs(options);
  if (options.designFirst && options.github === undefined) {
    throw new Error("--design-first needs --github owner/name: the repository on GitHub that will hold the work. It does not have to exist yet.");
  }
  if (options.ref !== undefined && (!/^[\w./-]+$/.test(options.ref) || options.ref.startsWith("-"))) throw new Error("--ref must be a plain branch name");
  if (options.github !== undefined && !GITHUB_REPO.test(options.github)) throw new Error("--github must be written as owner/name, such as octocat/hello-world");
  return options;
}

/** --connect takes everything but the documentation's place from docs.config.json. */
function checkConnectArgs(options) {
  if (options.designFirst) throw new Error("--connect ends design-first mode, so it does not go with --design-first.");
  const extra = ["project", "owner", "code", "github", "ref", "root"].filter((name) => options[name] !== undefined);
  if (extra.length > 0) throw new Error(`--connect reads everything but --docs from ${CONFIG_FILE}. Leave out --${extra.join(", --")}.`);
}

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const toPosix = (path) => path.replaceAll("\\", "/");

function run(cwd, command, args) {
  return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** Git's answer, or null when git says no by its exit code, as it does for a missing branch or remote. */
function gitAnswer(cwd, args) {
  try {
    return run(cwd, "git", args);
  } catch (cause) {
    if (cause.code === "ENOENT") throw new Error("git is not installed, or is not on the PATH");
    if (typeof cause.status === "number") return null;
    throw cause;
  }
}

const gitSays = (cwd, args) => gitAnswer(cwd, args) !== null;

/** The GitHub name of a remote address, owner/name, or null when the remote is not on GitHub. */
export function githubFromRemote(url) {
  const match = /github\.com[:/]+([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(url.trim());
  const name = match ? `${match[1]}/${match[2]}` : null;
  return name !== null && GITHUB_REPO.test(name) ? name : null;
}

/** The repository on GitHub whose issues hold the work: given, or read from the origin remote. */
function findGithub(options, code) {
  if (options.github !== undefined) return options.github;
  const found = githubFromRemote(gitAnswer(code, ["remote", "get-url", "origin"]) ?? "");
  if (found !== null) return found;
  throw new Error("the code repository has no origin remote on GitHub, so its issues cannot be found. Pass --github owner/name: the repository on GitHub that will hold the work.");
}

/** The branch the documentation describes: given, or main, or master. */
function findRef(options, code) {
  if (options.ref !== undefined) return options.ref;
  const found = MAIN_BRANCHES.find((name) => gitSays(code, ["rev-parse", "--verify", "--quiet", `refs/heads/${name}`]));
  if (found !== undefined) return found;
  throw new Error("the code repository has no branch named main or master. Pass --ref with the branch the documentation should describe.");
}

function blanks(options, docs, code) {
  return {
    "{{PROJECT}}": options.project.trim(),
    "{{OWNER}}": options.owner.trim(),
    "{{PACKAGE}}": slug(options.project) || "project",
    "{{TODAY}}": formatDate(localToday()),
    "{{CODE_REPO}}": toPosix(relative(docs, code)) || ".",
    "{{CODE_REF}}": options.ref,
    "{{GITHUB}}": options.github,
    "{{ISSUES}}": `https://github.com/${options.github}/issues`,
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
    if (!TEXT_FILE.test(file)) continue;
    const text = readText(file);
    writeFileSync(file, file.includes(join("tools", "test")) ? text : fill(text, values));
  }
}

/** The configuration is written as data, so a name with quotes in it cannot break it. */
function writeConfig(docs, values, designFirst) {
  const config = {
    project: values["{{PROJECT}}"],
    codeRepo: values["{{CODE_REPO}}"],
    codeRef: values["{{CODE_REF}}"],
    github: values["{{GITHUB}}"],
    owner: values["{{OWNER}}"],
    ...(designFirst ? { designFirst: true } : {}),
  };
  writeFileSync(join(docs, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`);
}

function designFirstLine(values) {
  return `- ${values["{{TODAY}}"]} ${DESIGN_FIRST_MARK} It will be at \`${values["{{CODE_REPO}}"]}\`, and its work will be the issues of ${values["{{GITHUB}}"]}. Until it exists, the check skips code paths. When it does, run the living-docs skill's setup with \`--connect\` and \`--docs\` pointing here.`;
}

/** Adds setup's design-first line under Watch out in NOW.md. */
function addWatchOut(docs, line) {
  const file = join(docs, NOW_FILE);
  const text = readFileSync(file, "utf8");
  if (!text.includes(WATCH_OUT)) throw new Error(`the template's ${NOW_FILE} has no "${WATCH_OUT}" heading, which is a fault in the skill`);
  writeFileSync(file, text.replace(WATCH_OUT, `${WATCH_OUT}\n\n${line}`));
}

/** Takes setup's design-first line out of NOW.md and dates the change. True when the line was there. */
function removeWatchOut(docs, today) {
  const file = join(docs, NOW_FILE);
  const lines = readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n");
  const kept = lines.filter((line) => !line.includes(DESIGN_FIRST_MARK));
  const text = kept
    .join("\n")
    .replace(/^Updated: .*$/m, `Updated: ${today}, by setup`)
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n*$/, "\n");
  writeFileSync(file, text);
  return kept.length < lines.length;
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
  const block = fill(readText(join(POINTERS, templateName)), values);
  const agents = join(folder, "AGENTS.md");
  writeFileSync(agents, withBlock(existsSync(agents) ? readFileSync(agents, "utf8") : "", block));
  const claude = join(folder, "CLAUDE.md");
  if (!existsSync(claude)) writeFileSync(claude, "@AGENTS.md\n");
  else if (!readFileSync(claude, "utf8").includes("@AGENTS.md")) return `${claude} exists and does not import AGENTS.md. Add the line @AGENTS.md to it.`;
  return null;
}

/** A Claude Code hook that loads NOW.md when a session starts in `folder`. Never overwrites settings. */
function writeSessionHook(folder, docsFromFolder) {
  const file = join(folder, ".claude", "settings.json");
  const script = `$CLAUDE_PROJECT_DIR/${docsFromFolder}/tools/session-start.mjs`;
  if (existsSync(file)) return `${file} already exists. To load NOW.md at the start of every Claude Code session there, add a SessionStart hook that runs: node "${script}"`;
  const hook = { type: "command", command: `node "${script}" 2>/dev/null || true`, timeout: 15, statusMessage: "Loading where the work is today" };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ hooks: { SessionStart: [{ hooks: [hook] }] } }, null, 2)}\n`);
  return null;
}

/** The issue forms and the pull request template, never over a file the repository already has. */
function writeGithubFiles(code, values) {
  return walk(CODE_GITHUB).map((source) => {
    const target = join(code, ".github", relative(CODE_GITHUB, source));
    const shown = toPosix(relative(code, target));
    if (existsSync(target)) return `kept the existing ${shown}. Compare it with ${toPosix(relative(HERE, source))} in the skill.`;
    mkdirSync(dirname(target), { recursive: true });
    const text = readText(source);
    writeFileSync(target, source.endsWith(".md") ? fill(text, values) : text);
    return null;
  });
}

function writeCodeFiles(code, values) {
  return [
    writePointer(code, "code-AGENTS.md", values),
    ...writeGithubFiles(code, values),
    writeSessionHook(code, values["{{DOCS_FROM_CODE}}"]),
  ];
}

function startGit(docs) {
  if (existsSync(join(docs, ".git"))) return;
  run(docs, "git", ["init", "-q", "-b", "main"]);
  run(docs, "git", ["add", "-A"]);
  run(docs, "git", ["commit", "-q", "-m", "docs: set up the documentation repository"]);
}

/** The check's verdict, its last line, and its whole report. It exits with an error when it finds one. */
function runCheck(docs) {
  try {
    return { passed: true, lastLine: run(docs, process.execPath, ["tools/check.mjs"]).trim().split("\n").at(-1) };
  } catch (cause) {
    const report = String(cause.stdout || cause.message).trim();
    return { passed: false, lastLine: report.split("\n").at(-1), report };
  }
}

/** The check's last line, or its whole report when it found errors. */
function checkNewRepository(docs) {
  const check = runCheck(docs);
  if (!check.passed) throw new Error(`the new repository's own check failed, which is a fault in the skill:\n${check.report}`);
  return check.lastLine;
}

/** The code is read as usual, or, in design-first mode, must not be a repository yet. */
function checkCodeFolder(options, code) {
  const isRepository = existsSync(code) && gitSays(code, ["rev-parse", "--is-inside-work-tree"]);
  if (options.designFirst) {
    if (isRepository) throw new Error(`${code} is already a git repository. Leave out --design-first, and setup reads it as usual.`);
    return;
  }
  if (!existsSync(code)) throw new Error(`the code repository was not found at ${code}. If the code does not exist yet, pass --design-first.`);
  if (!isRepository) throw new Error(`${code} is not a git repository`);
}

/** Joins a documentation repository set up with --design-first to its code, once the code exists. */
function connect(options) {
  const docs = resolve(options.docs);
  const config = loadConfig(docs);
  if (!config.designFirst) throw new Error(`${docs} is not waiting for its code: its ${CONFIG_FILE} has no "designFirst". Nothing was changed.`);
  const missing = ["project", "owner", "github"].filter((key) => config[key] === null);
  if (missing.length > 0) throw new Error(`${CONFIG_FILE} in ${docs} has no "${missing.join('", "')}", so the code's files cannot be written. Nothing was changed.`);
  const code = config.codeRepo;
  if (!codeIsReady(code, config.codeRef)) {
    throw new Error(`the code is not ready at ${code}: it must be a git repository with a commit on ${config.codeRef}. Nothing was changed.`);
  }
  const values = blanks({ project: config.project, owner: config.owner, ref: config.codeRef, github: config.github }, docs, code);
  const notes = options.codeFiles ? writeCodeFiles(code, values) : [];
  writeConfig(docs, values, false);
  if (!removeWatchOut(docs, values["{{TODAY}}"])) notes.push(`${NOW_FILE} had no line saying the code does not exist yet. Check it by hand.`);
  const check = runCheck(docs);
  if (!check.passed) notes.push(`the check found errors now that it reads the code. Run npm run check in ${docs} and fix them.`);
  notes.push(`${CONFIG_FILE} and ${NOW_FILE} changed in ${docs}. Commit them there.`);
  return { docs, code, github: config.github, ref: config.codeRef, checked: check.lastLine, notes: notes.filter(Boolean), connected: true };
}

export function setup(argv) {
  const options = parseArgs(argv);
  if (options.connect) return connect(options);
  const docs = resolve(options.docs);
  const code = resolve(options.code);
  checkCodeFolder(options, code);
  if (existsSync(docs) && readdirSync(docs).length > 0) throw new Error(`${docs} already exists and is not empty. Nothing was changed.`);
  const settled = options.designFirst
    ? { ...options, ref: options.ref ?? MAIN_BRANCHES[0] }
    : { ...options, github: findGithub(options, code), ref: findRef(options, code) };
  const values = blanks(settled, docs, code);
  mkdirSync(docs, { recursive: true });
  copyTemplate(docs, values);
  writeConfig(docs, values, options.designFirst);
  if (options.designFirst) addWatchOut(docs, designFirstLine(values));
  run(docs, process.execPath, ["tools/build-indexes.mjs"]);
  const notes = options.codeFiles && !options.designFirst ? writeCodeFiles(code, values) : [];
  if (options.root) {
    notes.push(writePointer(resolve(options.root), "root-AGENTS.md", values));
    notes.push(writeSessionHook(resolve(options.root), values["{{DOCS_NAME}}"]));
  }
  const checked = checkNewRepository(docs);
  if (options.git) startGit(docs);
  return { docs, code, github: settled.github, ref: settled.ref, checked, notes: notes.filter(Boolean), designFirst: options.designFirst };
}

/** Where the documentation is, and the code and the issues it describes. */
function whereLines(result) {
  if (result.connected) {
    return [`Connected ${result.docs} to its code at ${result.code}.`, `It describes the branch ${result.ref}, and its work is the issues of ${result.github} on GitHub.`];
  }
  if (result.designFirst) {
    return [`Documentation repository ready at ${result.docs}, before its code.`, `The code will be at ${result.code}; until it exists, the check skips code paths. Its work will be the issues of ${result.github} on GitHub.`];
  }
  return [`Documentation repository ready at ${result.docs}`, `It describes the branch ${result.ref} of ${result.code}, and its work is the issues of ${result.github} on GitHub.`];
}

/** What setup tells the person who ran it: where things are, the check's verdict, the notes, what is next. */
function summaryLines(result) {
  const next = result.connected
    ? "Next: commit the changed files, and show the owner the new files in the code repository. Nothing has been changed on GitHub."
    : "Next: open NOW.md there. It lists what to do first. Nothing has been changed on GitHub yet.";
  return [...whereLines(result), `Its check says: ${result.checked}`, ...result.notes.map((note) => `Note: ${note}`), next];
}

function main() {
  try {
    const result = setup(process.argv.slice(2));
    const lines = summaryLines(result);
    process.stdout.write(`${lines.join("\n")}\n`);
  } catch (cause) {
    process.stderr.write(`Setup stopped. ${cause.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
