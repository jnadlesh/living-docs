# Living docs

A way to run a software project with AI agents so they stop working from stale information and stop rebuilding things that already exist. It gives a project three things:

- **A documentation repository beside the code.** It is the single source of truth. Every agent, in any harness (Claude Code, Codex or another), reads it before working and updates it before its work counts as done. It says how the project works today, one page per thing, plus what is happening right now, the decisions and why, and the rules for working with you.
- **Every piece of work as a GitHub issue, in one shape.** Every bug, feature, idea and decision is an issue on the code repository, with a plain title, three labels (what kind, which part, who asked), a milestone for its place in your order, and five headings: What, Why, How to see it, Where, Source. Issue forms and a pull request template hold the same shape on the website.
- **Scripts that keep it honest.** They build the table of contents and glossary from the pages, check that every file a page names still exists in the code, warn when the code behind a page changed after it was last checked, and put the labels and milestones on GitHub.

## Setting it up

You need Node 22 or newer, git, the GitHub command line tool signed in (`gh auth login`), and your code in a git repository on GitHub. If you are designing the project before writing any code, you only need to know where the code will go: setup's design-first mode writes the documentation now and connects it to the code later.

Give this folder to your agent in one of two ways:

- Start your agent in the folder that holds your code, and say: *Read SKILL.md in the living-docs folder at (wherever you put it), and set up living docs for my project.*
- Or install it as a skill, so any session can use it by name. Copy the `living-docs` folder into `~/.claude/skills/` for Claude Code, or `~/.codex/skills/` for Codex. Then say: *Set up living docs for this project.*

Your agent will ask you a few things: the project's name, your name, where the code is, the parts your project divides into, and the order you want work done in. It then walks you through the rules it arrived with, so you can keep, change or drop each one.

## What it changes

On your computer, it makes the new documentation repository. In your code repository, it adds:

- a short block at the top of `AGENTS.md`, keeping the rest of the file;
- a `CLAUDE.md` pointing to it, if you have none;
- the issue forms and pull request template under `.github`;
- a Claude Code hook in `.claude/settings.json` that loads today's notes when a session starts.

It never overwrites a file. Where one exists already, it tells you what to add by hand.

On GitHub it changes nothing until you say yes. Then it adds the labels, one milestone per step of your order, and a project board if you want one. It only adds; it never changes or deletes what is already there. Nothing is pushed anywhere without asking you.

## What is in this folder

- `SKILL.md` is what your agent reads.
- `setup.mjs` makes the documentation repository and the code repository's side of it.
- `template/` is the blank documentation repository: its pages, its rules, and its tools. That includes `tools/github.mjs`, which sets up GitHub.
- `code-github/` holds the issue forms and pull request template that setup copies into the code repository.
- `pointers/` holds the short blocks that setup adds to `AGENTS.md`.

Run the tests with `npm test`. They need git and nothing else. Nothing in them reaches GitHub.
