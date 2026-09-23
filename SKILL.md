---
name: living-docs
description: Set up and run a living documentation repository beside a code repository, with every piece of work tracked as a GitHub issue in one shape, so that every agent in any harness reads the same current facts before working and writes back what changed before its work counts as done. Use when the user wants project documentation that stays true, a map of a codebase that agents can look things up in, GitHub issues as the one tracker for bugs, features, ideas and decisions, shared memory between Claude Code, Codex and other harnesses, or says things like "set up the docs system", "living docs", "documentation repo", "set up issues the way my friend does", or "the agents keep rebuilding things that already exist".
---

# Living docs

A project gets a second repository that holds all of its documentation and is the single source of truth, and every piece of work becomes a GitHub issue on the code repository, written in one shape. Two promises make it work:

1. **Read first.** Every session reads the documentation before it works. Before building anything, look it up. If a page exists, the thing exists.
2. **Write back.** No work is done until the documentation is updated and the issue says what was verified.

Pages say what is true now and are rewritten, never appended to. Git history keeps the past, and closed issues keep the story of the work. Scripts build every index from the pages, check that every code path a page names still exists, warn when the code behind a page changed after it was last checked, and put the labels and milestones on GitHub, so nothing quietly goes stale.

## Setting it up for a project

Do the steps in order. The owner is the person you are working for. They decide anything that changes GitHub, pushes anywhere, or deletes anything; ask and wait where a step says so.

### 1. Check what is needed

- Node 22 or newer (`node --version`), and git.
- The GitHub command line tool, signed in: `gh auth status`. If it is missing, ask the owner to install it from https://cli.github.com. If it is signed out, ask the owner to run `gh auth login` themselves. Never type or handle their password or token.
- The code in a git repository that is on GitHub. If it is not on GitHub yet, stop and tell the owner: making the repository is their call.

### 2. Ask the owner

- The project's name, and their own name. Their name appears once, in the README. Everywhere else the documentation says "the owner", a role.
- Where the code repository is, if you do not already know.
- Where the documentation repository goes. Suggest a folder beside the code named after it with `-docs` on the end. If the code's parent folder holds only this project, suggest `--root` with that folder, so sessions started there find both repositories and load NOW.md.

### 3. Run setup

From this skill's folder:

```
node setup.mjs --project "<Project name>" --owner "<Their name>" --code <path to the code> --docs <path for the documentation> [--root <folder holding both>]
```

It finds the repository on GitHub from the code's origin remote; pass `--github owner/name` when there is none. It describes the branch `main`, or `master`, or the one given with `--ref`. `--no-code-files` leaves the code repository untouched. `--no-git` skips making the new repository a git repository.

What it does:

- Creates the documentation repository from `template/`: README, NOW.md, the table of contents, the glossary, AGENTS.md, `docs/`, `decisions/`, `work/` with the order of the work, `rules/` with the law, the owner's rules, the documentation rules and the code rules (issues, branches, checking), `reference/`, `archive/`, and `tools/`. It builds the indexes, runs the new repository's own check, and makes the first commit.
- In the code repository: a short marked block at the top of `AGENTS.md`, leaving the rest of the file alone; a `CLAUDE.md` holding `@AGENTS.md` when there is none; the issue forms under `.github/ISSUE_TEMPLATE/` and a pull request template; and a Claude Code hook in `.claude/settings.json` that loads NOW.md when a session starts.
- With `--root`, the same pointer and hook in that folder.
- It never overwrites a file. Where one exists, it prints a note saying what to add by hand. Tell the owner about every note.

### 4. Name the sections, with the owner

Read the code and propose its sections: one numbered folder under `docs/` per part of the product, usually five to twelve, such as `02-the-editor`. Each holds a `README.md` with a title, one sentence on what the section covers, and the two `generated:pages` markers, copied from `docs/01-the-product/README.md`. The folder's name without its number and without a leading "the" becomes the section's area label on GitHub, so keep it short: `02-the-editor` is `editor`. Agree the list with the owner, then run `npm run build` and `npm run check` in the documentation repository.

### 5. Put the labels and milestones on GitHub, on the owner's yes

Show the owner the tiers in `work/order.md`: the order work is done in, each a milestone. Change them if they want others. Then, in the documentation repository:

```
npm run github -- --dry-run
```

It lists the labels it would add (the kinds, where an issue came from, triage, and one area per section) and the milestones (one per tier). Show the owner. On their yes, run it again without `--dry-run`. It only adds; it never changes or deletes what is on GitHub, and it is safe to run again whenever a section or tier is added. It names GitHub's starter labels that the rules do not use; removing them is the owner's call.

A project board is optional. If the owner wants one, add `--board`, and `--workstreams "A,B,C"` for a Workstream field. Boards need a permission gh does not ask for at sign-in: the owner runs `gh auth refresh -s project` first.

### 6. Go through the owner's rules with them

`rules/working-with-the-owner.md` arrives with rules marked "from setup", taken from the project this system was built for. Go through them with the owner, one heading at a time. Keep what they want, rewrite what they want differently, remove the rest, and put the date they confirmed in place of each mark.

### 7. Commit, and ask before anything leaves the machine

- Commit what you changed in the documentation repository since setup: the sections, the order, the owner's rules. Stage only your own files. Take the Next up lines you finished out of NOW.md.
- Show the owner the new files in the code repository and commit them the way they want, on a branch or on main.
- Ask whether the documentation repository should have its own repository on GitHub, private unless they say otherwise. Only on their yes: `gh repo create <owner>/<name> --private --source <docs path> --push`. Pushing the code repository is their call too.

### 8. Write the first pages

Write pages from the code, not from old documents. Each page follows `rules/docs/page-template.md` exactly: what it is, how it works, where it lives, related, decisions, last checked, in prose a person who does not program can follow (`rules/docs/writing-documentation.md`). Parallel agents can each take one section, since they never touch the same files. Only one session runs `npm run build`, then `npm run check`, and commits.

## Bringing in what the project already has

- **Old documents** (a docs folder, long READMEs, plans, notes) are source material, not truth. Check each claim against the code and write the pages from the code. Then, on the owner's yes, move the old files into `archive/` in the documentation repository, and list them in its README.
- **Work tracked somewhere else** (a to-do file, a plan, another tracker) becomes issues, on the owner's yes: one issue per open item, in the one shape, with the item's own words under Source and its tier as the milestone.
- **Agents' private memories** hold facts the documentation needs. Read them once, move project facts into pages and rules about the owner into `rules/working-with-the-owner.md`.

## Working in a project that has it

The documentation repository holds the full rules; start from its `rules/README.md`. In short:

- **Start.** Read `NOW.md`. Look up what you are about to touch: `npm run find -- <words>`, or the table of contents.
- **Before work.** Every piece of work is an issue, in the shape `rules/code/issues.md` gives: a plain title, three labels (kind, area, from), the tier as milestone, and five headings (What, Why, How to see it, Where, Source). File it with `gh issue create` if it does not exist. Claim it with a comment, work on a branch named `<agent>/<number>-<short-name>`, and add a dated line to NOW.md.
- **While working.** Notes go in comments on the issue, always ending with the exact next action.
- **Finish.** `npm run pages-for -- main..<branch>` lists the pages your change touches and any changed file no page covers. Rewrite those pages, write a page for anything new, take your line out of NOW.md, close the issue with a comment saying what was verified and where, run `npm run build` then `npm run check`, and commit only your own files.
- **When the owner corrects you** or states a lasting preference, add it to `rules/working-with-the-owner.md` in the same sitting. Do not keep it in private memory.
- **Wherever an issue is mentioned**, it is a link with its title on it, never a bare number.

## What the check enforces

The page shape and a 150-line cap, real code paths on the chosen branch, working links, unique page titles, dated lines and a 60-line cap in NOW.md, decisions with a numbered name and a status line that links a real decision, retired words, and indexes that match the pages. It warns, without failing, when the code behind a page changed after the page was last checked, and about broken links in `work/` and `reference/`. The warning is how drift gets noticed without anyone having to remember.

## Bringing a project up to a newer version of this skill

The tools live in each documentation repository, so a project keeps working if this skill changes. To update a project, compare this skill's `template/tools/` with the project's `tools/`, copy over what changed, and run `npm test` and `npm run check` there before committing.
