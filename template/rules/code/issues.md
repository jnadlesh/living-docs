# Issues

All work on {{PROJECT}} is tracked as GitHub issues on the code repository, [{{GITHUB}}]({{ISSUES}}): every bug, every feature, every idea and every decision waiting on the owner. An issue is the one place a piece of work lives. The documentation says what {{PROJECT}} is; the issues say what is being done to it. Nothing is tracked in a plan file, a task file, a list page or a private memory.

## One shape for every issue

Every issue is written the same way, whoever writes it, so the list reads as one list. Issue forms in the code repository, under `.github/ISSUE_TEMPLATE`, hold the same shape for anyone filing from the website.

**Title.** One plain sentence in the present tense, under 80 characters, that says what is wrong or what should exist. A bug names the behaviour: "The save button does nothing on a new file." A feature names what a person can do: "A person can export a report as a PDF." An idea starts with "Idea:" and a decision starts with "Decide:".

**Labels.** Three, always, one from each family.

| Family | Labels |
|---|---|
| kind | `bug`, `feature`, `idea`, `decision`, `cleanup`, `research` |
| area | one per section under `docs/`, named after its folder, and `docs` for the documentation itself |
| from | `from-owner`, `from-agent`, `from-user` |

The area labels are the sections of the documentation, so an issue and the page it touches share a name: the section `02-the-editor` is the label `editor`. `from-user` marks something filed by a person using {{PROJECT}}, not by the owner or an agent; those arrive with a `triage` label and no milestone until someone reads them. `npm run github` adds any label that is missing, including the area label of a new section.

**Milestone.** The tier of the owner's [order](../../work/order.md), on internal work only. An idea has no milestone until it is promoted to a feature. Something from a user has no milestone until it is triaged.

**Body.** Five headings, always in this order, written in plain words the owner can read.

- **What.** One paragraph: what happens, or what should exist.
- **Why.** One or two sentences on why it matters. "Not recorded." when nobody said.
- **How to see it.** For a bug, the steps that make it happen. For a feature, what done looks like: things a person can check, not intentions.
- **Where.** The documentation page it touches, and the code paths if known.
- **Source.** Who asked and when. When it was the owner, the owner's exact words, not a summary.

## Filing one

An agent files from the command line. Write the body to a file first, with the five headings as `## What`, `## Why` and so on, then:

```
gh issue create --repo {{GITHUB}} --title "The save button does nothing on a new file" --label bug --label editor --label from-owner --milestone "1 Bugs and usability" --body-file issue.md
```

When the code repository has a project board, add the new issue to it, as below.

## Working an issue

One issue is one thing. If a piece of work turns out to be two, open a second issue and link them; do not grow the first.

Wherever an issue is mentioned, in chat, in a page, in NOW, the number is a link with the issue's title on it: `[#12]({{ISSUES}}/12 "The title of the issue")`. A bare number tells the reader nothing until they go and look.

The branch is named after whoever holds it and the issue: `claude/123-short-name`, `codex/123-short-name`. The merge commit, or the pull request when there is one, says `Closes #123`, so the issue closes when the work lands. Progress goes in comments on the issue, not in a separate file: the branch, what has been proved and how, and the exact next action, so a new agent can pick it up from the issue alone.

An issue is never closed silently. The closing comment names the commit or pull request and says in one sentence what was verified and where. A decision issue closes by linking the decision file in `decisions/`. An issue closed as "not doing" says who decided and why.

When an issue is done, the documentation page it touches is updated in the same change, as [using the documentation](../docs/using-the-documentation.md) requires. That is what keeps the two from drifting: the issue says it happened, the page says what is true now.

## The project board

A board is optional. When the owner wants one, `npm run github -- --board` makes it on GitHub and links it to the code repository, and adding `--workstreams "Editor,Sync"` gives it a Workstream field: the kind of work an issue is, so that issues built together sit together. The board is the order within a tier, which the owner sets by dragging; the issue is the work. Whether an issue is open is the issue itself, and its tier is the milestone, so the board holds neither. A new issue is added with `gh project item-add <number> --owner <owner> --url <the issue's address>`.

## What is not an issue

A fact about how {{PROJECT}} works belongs on a page in `docs/`. A rule belongs here in `rules/`. A choice that has been made belongs in `decisions/`. What is happening right now, across everything, is `NOW.md`, which points at issues rather than restating them.

## Where this came from

GitHub's own guidance on issues, labels and milestones, and the practice of linking branches and pull requests to issues so that the history is kept by the tool.
