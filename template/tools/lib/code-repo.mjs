// Reads the code repository the documentation describes. Paths are checked against a
// branch, not against whatever happens to be checked out, because the working folder
// may sit on an old branch while the documentation describes the main line.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

export const CONFIG_FILE = "docs.config.json";
const GIT_LIST_LIMIT_BYTES = 64 * 1024 * 1024;

/** Reads docs.config.json and fails with a clear message when it is unusable. */
export function loadConfig(root) {
  const file = join(root, CONFIG_FILE);
  if (!existsSync(file)) throw new Error(`${CONFIG_FILE} is missing from ${root}`);
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  const { codeRepo, codeRef, owner } = parsed;
  if (typeof codeRepo !== "string" || codeRepo.length === 0) {
    throw new Error(`${CONFIG_FILE}: "codeRepo" must be a path`);
  }
  if (typeof codeRef !== "string" || !/^[\w./-]+$/.test(codeRef) || codeRef.startsWith("-")) {
    throw new Error(`${CONFIG_FILE}: "codeRef" must be a plain branch or tag name`);
  }
  if (owner !== undefined && (typeof owner !== "string" || owner.trim().length === 0)) {
    throw new Error(`${CONFIG_FILE}: "owner", when given, is the name of the person who owns the project`);
  }
  const location = isAbsolute(codeRepo) ? codeRepo : resolve(root, codeRepo);
  return { codeRepo: location, codeRef, owner: owner === undefined ? null : owner.trim() };
}

/** Every file and folder tracked at `ref`, as forward-slash paths from the repository root. */
export function trackedPaths(repo, ref) {
  if (!existsSync(repo)) throw new Error(`code repository not found at ${repo}`);
  const output = execFileSync("git", ["-C", repo, "ls-tree", "-r", "--name-only", "-z", ref], {
    encoding: "utf8",
    maxBuffer: GIT_LIST_LIMIT_BYTES,
  });
  const files = output.split("\0").filter((path) => path.length > 0);
  const known = new Set(files);
  for (const file of files) {
    const parts = file.split("/");
    for (let depth = 1; depth < parts.length; depth += 1) {
      known.add(parts.slice(0, depth).join("/"));
    }
  }
  return known;
}

/** A path as the documentation rules require it: from the repository root, no tricks. */
export function isPlainRepoPath(path) {
  if (path.startsWith("/") || path.startsWith("-") || /^[a-z]:/i.test(path)) return false;
  if (path.includes("\\") || path.includes("*")) return false;
  return !path.split("/").some((part) => part === ".." || part === "." || part === "");
}

const RANGE = /^[\w./~^@{}-]+(\.{2,3}[\w./~^@{}-]+)?$/;

/** The files a range of commits changed, such as "main~3..main" or "main...my-branch". */
export function changedFiles(repo, range) {
  if (!RANGE.test(range) || range.startsWith("-")) throw new Error(`not a commit range: ${range}`);
  const output = execFileSync("git", ["-C", repo, "diff", "--name-only", "-z", range], {
    encoding: "utf8",
    maxBuffer: GIT_LIST_LIMIT_BYTES,
  });
  return output.split("\0").filter((path) => path.length > 0);
}

/** How many commits on `ref` touched any of these paths after the end of the given day. */
export function commitsSince(repo, ref, paths, day) {
  if (paths.length === 0) return 0;
  const output = execFileSync(
    "git",
    ["-C", repo, "log", "--oneline", `--since=${day} 23:59:59`, ref, "--", ...paths],
    { encoding: "utf8", maxBuffer: GIT_LIST_LIMIT_BYTES },
  );
  return output.split("\n").filter((line) => line.length > 0).length;
}
