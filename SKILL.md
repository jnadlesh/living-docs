---
name: living-docs
description: Set up and run a living documentation repository beside a code repository, so that every agent in any harness reads the same current facts before working and writes back what changed before its work counts as done. Use when the user wants project documentation that stays true, a map of a codebase that agents can look things up in, shared memory between Claude Code, Codex and other harnesses, or says things like "set up the docs system", "living docs", "documentation repo", or "the agents keep rebuilding things that already exist".
---

# Living docs

A project gets a second repository that holds all of its documentation and is the single source of truth. Two promises make it work:

1. **Read first.** Every session reads the documentation before it works. Before building anything, look it up. If a page exists, the thing exists.
2. **Write back.** No work is done until the documentation is updated.

Pages say what is true now and are rewritten, never appended to. Git history keeps the past. Scripts build every index from the pages and check that every code path a page names still exists, so the map cannot quietly go stale.

## Setting it up for a project

Ask the user for the project's name, their own name, and where the code repository is. Then run, from this skill's folder:

```
node setup.mjs --project "<Project name>" --owner "<Their name>" --code <path to the code repository> --docs <path for the new documentation repository>
```

Options: `--ref <branch>` names the branch of the code that pages are checked against, default `main`. `--root <folder>` also writes the pointer into a folder that holds both repositories, for sessions started there. `--no-pointer` leaves the code repository untouched. `--no-git` skips creating a git repository.

What it does:

- Creates the documentation repository from the template: README, NOW.md, the table of contents, the glossary, `docs/`, `decisions/`, `work/`, `rules/`, `reference/`, `archive/` and `tools/`.
- Points its check at the code repository and branch.
- Adds a short marked block to the top of `AGENTS.md` in the code repository, saying where the documentation is and the two promises. It leaves the rest of that file alone. If there is no `CLAUDE.md`, it creates one holding the single line `@AGENTS.md`, so Claude Code reads the same rules file as every other harness.
- With `--root`, also adds a Claude Code hook in that folder so every session starts with NOW.md already loaded. It never overwrites an existing settings file.
- Refuses to write into a folder that already has files.

Then do the two things its NOW.md lists: fill in `rules/working-with-the-owner.md` with the user, and name the sections of the project under `docs/`.

## Working in a project that has it

Read `rules/docs/using-the-documentation.md` in the documentation repository. In short:

- Start: read `NOW.md`, then look up what you are about to touch. `npm run find -- <words>` prints the matching pages, what each thing is, and its files. Or open `TABLE-OF-CONTENTS.md` and pick the section.
- Bigger work gets a task file in `work/`, with the user's request in their exact words.
- Finish: run `npm run pages-for -- <commit range>` to list the pages your change touches and any changed file no page covers. Rewrite those pages, write a page for anything new, take your line out of `NOW.md`, run `npm run build` then `npm run check`, commit only your own files.
- When the user corrects you or states a lasting preference, add it to `rules/working-with-the-owner.md` in the same sitting. Do not keep it in private memory.

## Writing the first pages

Name sections as numbered folders under `docs/`, such as `02-the-editor`, each with a `README.md` that holds a title, one sentence, and the two `generated:pages` markers, copied from `docs/01-what-it-is/README.md`. Write pages from the code, not from old documents. Each page follows `rules/docs/page-template.md` exactly: what it is, how it works, where it lives, related, decisions, last checked. Parallel agents can each take one section, since they never touch the same files. Only one session runs `npm run build`.

## What the check enforces

The page shape and a 150-line cap, real code paths on the chosen branch, working links, dated lines and a 60-line cap in NOW.md, task files with dates and a known status, decisions with a status line that links a real decision, retired words, and indexes that match the pages. It also warns, without failing, when the code behind a page changed after the page was last checked. That warning is how drift gets noticed without anyone having to remember.
