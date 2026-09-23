#!/usr/bin/env node
// Sets up the GitHub side of the issues rule on the code repository: the labels, the
// milestones and, when asked, a project board. It only adds. It never changes or deletes
// anything that is already there.
//   node tools/github.mjs --dry-run      say what it would add, and change nothing
//   node tools/github.mjs                add what is missing
//   node tools/github.mjs --board [--workstreams "Editor,Sync,Billing"]   a project board too
// The repository comes from docs.config.json, the area labels from the sections under docs/,
// and the milestones from the tiers in work/order.md, so each is written down once. Run it
// again whenever a section or a tier is added. It needs the GitHub command line tool, gh,
// signed in as someone who may change the repository.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadConfig } from "./lib/code-repo.mjs";
import { CHAPTER_INTRO, DOCS_DIR, WORK_DIR, listChapters } from "./lib/layout.mjs";
import { parsePage, sectionBody } from "./lib/markdown.mjs";

export const ORDER_FILE = `${WORK_DIR}/order.md`;
const TIERS_HEADING = "The tiers";
const TIER_ITEM = /^\d+\.\s+\*\*(.+?)\*\*[\s:.]*(.*)$/;
const AREA_COLOR = "bfdadc";
const DOCS_AREA = { name: "docs", color: AREA_COLOR, description: "The documentation itself" };
const LIST_LIMIT = "500";
const OUTPUT_LIMIT_BYTES = 16 * 1024 * 1024;

/** The kind, from and triage labels of the issues rule. Every repository gets the same ones. */
export const FIXED_LABELS = Object.freeze([
  { name: "bug", color: "d73a4a", description: "Something does the wrong thing" },
  { name: "feature", color: "0e8a16", description: "Something a person should be able to do" },
  { name: "idea", color: "fbca04", description: "Could be built one day; not scheduled until it becomes a feature" },
  { name: "decision", color: "5319e7", description: "A choice waiting on the owner" },
  { name: "cleanup", color: "c5def5", description: "Tidying that changes no behaviour" },
  { name: "research", color: "1d76db", description: "A question to answer before building" },
  { name: "from-owner", color: "000000", description: "Asked for by the owner" },
  { name: "from-agent", color: "6e6e6e", description: "Found by an agent" },
  { name: "from-user", color: "e99695", description: "Filed by someone using the project" },
  { name: "triage", color: "fef2c0", description: "Not read yet; no milestone until someone reads it" },
]);

/** GitHub's starter labels. The issues rule does not use them. They are reported, never removed. */
const STARTER_LABELS = new Set(["documentation", "duplicate", "enhancement", "good first issue", "help wanted", "invalid", "question", "wontfix"]);

/** One area label per section under docs/, named after its folder: "02-the-editor" is "editor". */
export function areaLabels(root) {
  const fixed = new Set(FIXED_LABELS.map((label) => label.name));
  const seen = new Map([[DOCS_AREA.name, "the documentation"]]);
  const areas = listChapters(root).map((chapter) => {
    const name = chapter.replace(/^\d\d-/, "").replace(/^the-/, "");
    if (fixed.has(name)) throw new Error(`the section ${chapter} would make the area label "${name}", which the issues rule already uses. Rename the section's folder.`);
    if (seen.has(name)) throw new Error(`the sections ${seen.get(name)} and ${chapter} would both make the area label "${name}". Rename one folder.`);
    seen.set(name, chapter);
    const title = parsePage(readFileSync(join(root, DOCS_DIR, chapter, CHAPTER_INTRO), "utf8")).title ?? chapter;
    return { name, color: AREA_COLOR, description: `Documentation section ${chapter.slice(0, 2)}: ${title}`.slice(0, 100) };
  });
  return [...areas, DOCS_AREA];
}

/** The tiers of the owner's order, from work/order.md. Each is a milestone of the same name. */
export function readTiers(root) {
  const text = readFileSync(join(root, ORDER_FILE), "utf8").replace(/\r\n/g, "\n");
  const body = sectionBody(parsePage(text), TIERS_HEADING) ?? "";
  const tiers = body
    .split("\n")
    .map((line) => TIER_ITEM.exec(line.trim()))
    .filter(Boolean)
    .map(([, title, rest]) => ({ title: title.replace(/[.:]+$/, "").trim(), description: rest.trim() }));
  if (tiers.length === 0) {
    throw new Error(`${ORDER_FILE} lists no tiers. Under "## ${TIERS_HEADING}", write each as a numbered line that starts with its name in bold, such as: 1. **1 Bugs and usability**: what goes in it.`);
  }
  return tiers;
}

/** Runs the real gh. A failure says which command failed and why, in one line. */
function realGh(args) {
  try {
    return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: OUTPUT_LIMIT_BYTES });
  } catch (cause) {
    if (cause.code === "ENOENT") throw new Error("the GitHub command line tool, gh, is not installed. Install it from https://cli.github.com, then have the owner run: gh auth login");
    const detail = String(cause.stderr || cause.message).trim().split("\n").at(-1);
    throw new Error(`gh ${args.slice(0, 2).join(" ")} failed: ${detail}`);
  }
}

/** What is on GitHub already: label names in lower case, since GitHub ignores case, and milestone titles. */
function readRepository(gh, repo) {
  const labels = JSON.parse(gh(["label", "list", "--repo", repo, "--limit", LIST_LIMIT, "--json", "name"])).map((label) => label.name);
  const milestones = JSON.parse(gh(["api", `repos/${repo}/milestones?state=all&per_page=100`])).map((milestone) => milestone.title);
  return { labels, milestones };
}

/** What to add: everything wanted that GitHub does not have yet. */
export function plan(wanted, existing) {
  const labels = new Set(existing.labels.map((name) => name.toLowerCase()));
  const milestones = new Set(existing.milestones);
  return {
    labels: wanted.labels.filter((label) => !labels.has(label.name.toLowerCase())),
    keptLabels: wanted.labels.filter((label) => labels.has(label.name.toLowerCase())).map((label) => label.name),
    milestones: wanted.milestones.filter((tier) => !milestones.has(tier.title)),
    keptMilestones: wanted.milestones.filter((tier) => milestones.has(tier.title)).map((tier) => tier.title),
    starters: existing.labels.filter((name) => STARTER_LABELS.has(name.toLowerCase())),
  };
}

function apply(gh, repo, todo) {
  for (const label of todo.labels) {
    gh(["label", "create", label.name, "--repo", repo, "--color", label.color, "--description", label.description]);
  }
  for (const tier of todo.milestones) {
    gh(["api", "--method", "POST", `repos/${repo}/milestones`, "-f", `title=${tier.title}`, "-f", `description=${tier.description}`]);
  }
}

/** The project board: found by title or made, linked to the repository, with its Workstream field. */
function board(gh, { repo, title, workstreams, dryRun }) {
  const [owner, name] = repo.split("/");
  const listed = JSON.parse(projectCommand(gh, ["project", "list", "--owner", owner, "--format", "json", "--limit", "200"]));
  const found = (listed.projects ?? []).find((project) => project.title === title);
  if (dryRun) return [found ? `Board: "${title}" exists as number ${found.number}. It would be linked to ${repo}.` : `Board: would make "${title}" and link it to ${repo}.`];
  const number = found ? found.number : JSON.parse(projectCommand(gh, ["project", "create", "--owner", owner, "--title", title, "--format", "json"])).number;
  const lines = [found ? `Board: "${title}" already exists as number ${number}.` : `Board: made "${title}", number ${number}.`];
  try {
    gh(["project", "link", String(number), "--owner", owner, "--repo", name]);
    lines.push(`Board: linked to ${repo}.`);
  } catch (cause) {
    lines.push(`Note: the board could not be linked to ${repo}, which is fine if it already was: ${cause.message}`);
  }
  if (workstreams.length > 0) lines.push(workstreamField(gh, { owner, number, workstreams }));
  return lines;
}

function workstreamField(gh, { owner, number, workstreams }) {
  const fields = JSON.parse(gh(["project", "field-list", String(number), "--owner", owner, "--format", "json"])).fields ?? [];
  if (fields.some((field) => field.name === "Workstream")) return "Board: the Workstream field is already there, and was left as it is.";
  gh(["project", "field-create", String(number), "--owner", owner, "--name", "Workstream", "--data-type", "SINGLE_SELECT", "--single-select-options", workstreams.join(",")]);
  return `Board: added the Workstream field with ${workstreams.length} choices.`;
}

/** Project commands need an extra permission that gh does not ask for when it signs in. */
function projectCommand(gh, args) {
  try {
    return gh(args);
  } catch (cause) {
    if (/scope|permission|INSUFFICIENT/i.test(cause.message)) {
      throw new Error(`gh may not manage projects yet. Ask the owner to run: gh auth refresh -s project. (${cause.message})`);
    }
    throw cause;
  }
}

export function parseOptions(argv) {
  const options = { dryRun: false, board: false, workstreams: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--board") options.board = true;
    else if (arg === "--workstreams" && i + 1 < argv.length) options.workstreams = argv[(i += 1)].split(",").map((w) => w.trim()).filter(Boolean);
    else throw new Error(`unexpected argument: ${arg}. See the top of tools/github.mjs.`);
  }
  if (options.workstreams.length > 0 && !options.board) throw new Error("--workstreams belongs to the board: add --board");
  return options;
}

const named = (items) => (items.length === 0 ? "" : ` (${items.join(", ")})`);

function summary({ repo, dryRun, todo }) {
  const verb = dryRun ? "to add" : "added";
  const lines = [
    `GitHub setup for ${repo}${dryRun ? ". Dry run: nothing was changed." : "."}`,
    `Labels: ${todo.labels.length} ${verb}${named(todo.labels.map((label) => label.name))}. ${todo.keptLabels.length} already there, left as they are${named(todo.keptLabels)}.`,
    `Milestones: ${todo.milestones.length} ${verb}${named(todo.milestones.map((tier) => tier.title))}. ${todo.keptMilestones.length} already there${named(todo.keptMilestones)}.`,
  ];
  if (todo.starters.length > 0) {
    lines.push(`Note: GitHub's starter labels are still on the repository: ${todo.starters.join(", ")}. The issues rule does not use them. Remove them on the repository's Labels page if the owner agrees.`);
  }
  return lines;
}

/** Does the whole job and returns what it did, one line each. `gh` can be replaced in tests. */
export function setupGithub({ root, argv, gh = realGh }) {
  const options = parseOptions(argv);
  const config = loadConfig(root);
  if (config.github === null) throw new Error('docs.config.json does not name the repository on GitHub. Add a line like "github": "owner/name".');
  const wanted = { labels: [...FIXED_LABELS, ...areaLabels(root)], milestones: readTiers(root) };
  try {
    gh(["api", "user", "--jq", ".login"]);
  } catch (cause) {
    throw new Error(`gh is not signed in to GitHub. Ask the owner to run: gh auth login. (${cause.message})`);
  }
  const todo = plan(wanted, readRepository(gh, config.github));
  if (!options.dryRun) apply(gh, config.github, todo);
  const lines = summary({ repo: config.github, dryRun: options.dryRun, todo });
  if (!options.board) return lines;
  const title = `${config.project ?? config.github.split("/")[1]} work`;
  return [...lines, ...board(gh, { repo: config.github, title, workstreams: options.workstreams, dryRun: options.dryRun })];
}

function main() {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  process.stdout.write(`${setupGithub({ root, argv: process.argv.slice(2) }).join("\n")}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (cause) {
    process.stderr.write(`GitHub setup stopped. ${cause.message}\nIt only ever adds what is missing, so run it again once the cause is fixed.\n`);
    process.exitCode = 1;
  }
}
