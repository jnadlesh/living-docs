# Using the documentation

The rules every agent follows, in any harness. They exist so that no agent works from stale information, and no system gets built twice because someone did not know it existed.

## Before you work

1. Read [NOW.md](../../NOW.md). It says what is in flight, what is waiting on the owner, and what to watch out for.
2. Know [how the owner wants to be worked with](../working-with-the-owner.md). If your work touches the code, read [how we build](../how-we-build.md) too.
3. Look up what you are about to touch. Open the [table of contents](../../TABLE-OF-CONTENTS.md) and pick the section. The section lists every page, what the thing is, and where it lives in the code. Or ask in one step: `npm run find -- <words>` prints the matching pages, what each thing is, and its files.
4. If a page exists, the thing exists. Use it. Do not build a second one.
5. If no page exists, the thing is new. Building it includes writing its page.

## While you work

Every piece of work is a GitHub issue on the code repository, in the shape the [issues rule](../code/issues.md) gives. If there is no issue for what you are about to do, open one first, with the owner's exact words under Source. A quick fix gets an issue too; it is one line, and it is the history.

1. Claim the issue: comment that you are on it, and name your branch, such as `claude/123-short-name`.
2. Add one dated line under In flight in [NOW.md](../../NOW.md), with the issue as a link.
3. Keep your notes as comments on the issue as you go: what you found, what you did, what you could not verify, and always the exact next action, so another agent can pick it up from the issue alone.

## When you finish

The work is not done until all of this is done.

1. Find the pages your work touched. Run `npm run pages-for -- main..your-branch`, or `npm run pages-for -- --files` followed by the files you changed. It lists every page that names those files, and any changed file that no page covers.
2. Update each of those pages. Write what is true now, and set Last checked to today.
3. Write a new page for anything new. See [writing documentation](writing-documentation.md).
4. Remove your line from NOW.md. Update Next up or Waiting on the owner if your work changed them.
5. Close the issue with a comment that names the commit or pull request and says in one sentence what was verified and where. A pull request that says `Closes #123` closes it on merge; the comment still says what was verified.
6. Run `npm run build`, then `npm run check`. Fix every error. Read every warning. A warning that a page's files changed since it was last checked means nobody has confirmed that page against the new code. If it is yours to fix, fix it. If not, leave it, so the next person sees it.
7. Commit and push. See Commits below.

With parallel agents, the orchestrator does these steps on their behalf. The agents keep notes on their issues. One session writes the documentation.

## Where a document goes

Ask in order, and stop at the first yes.

1. Is it no longer true? `archive/`
2. Is it a choice we made, and the reason for it? `decisions/`
3. Is it a piece of work: a bug, a feature, an idea, a decision to make? An issue on the code repository, never a file here.
4. Is it true about {{PROJECT}} today? `docs/`, in the section it belongs to.
5. Is it the thinking behind a body of work, before it becomes issues? `work/plans/`
6. Is it a picture, a screenshot or research? `reference/`

## NOW.md

- It has five headings, always in this order: In flight, Waiting on the owner, Next up, Parked, Watch out.
- Each line is one thing, and starts with the date it was added, written like 2026-09-17. Never write "yesterday" or "last week".
- A line exists only while the thing is true. Finished work lives in `docs/`, in the closed issue and in the git history.
- Touch only your own lines. Leave the others alone. Update the date at the top.
- An old line is a question, not a fact. If something has been in flight for more than a week, check whether the branch still exists and whether the work landed. Then fix the line, or ask the owner.
- If you find a line that is plainly dead, remove it and say so in your commit message.
- The cap is sixty lines. The check fails above it.

## Commits

Git history is the audit log. Pages hold the present. Commits hold the past.

- One write-back is one commit. Commit as the work lands, not at the end of the week.
- Stage only the files you wrote. Never stage everything. Other agents may have work in the same folder.
- Pull before you write. Push right after you commit, as [working with the owner](../working-with-the-owner.md) allows.
- The message says what changed and why. It names the issue, and the commit in the code repository that the change describes.
- Pushing the code repository follows the owner's own rule for it.

To check earlier work, read the history of one page, or the record of when each line last changed, or the page as it stood at any commit.

## Private memory

Your harness may keep its own memory. Treat it as a notepad.

- A fact about the project goes in this documentation, not in your memory.
- A fact about working with the owner goes here too, in `rules/`. Every harness needs it, not only the one that heard it.
- Keep in private memory only what is private to your harness, such as a quirk of its own tools.
- If your memory and this documentation disagree, this documentation wins. Then fix whichever is wrong.
