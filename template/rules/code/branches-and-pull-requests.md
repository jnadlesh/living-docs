# Branches and pull requests

How work moves through git and GitHub on {{PROJECT}}: when to branch, when a worktree is worth it, how a change reaches main, and what never happens. These are the field's settled practices, from the sources named at the end, fitted to a project where one owner directs several agents. The owner's own rules in [working with the owner](../working-with-the-owner.md) stand above these.

## The one rule everything else follows from

Main is what the owner runs. It builds, it starts, and the feature that just landed works the way the owner saw it work. A red check on main is fixed the same day. This is the trunk-based rule, and it is why the rest exists.

## When to make a branch

Any change that takes more than one sitting, touches more than one part of {{PROJECT}}, or that another agent might be working near, goes on a branch. A one-line fix that is tested and complete can go straight onto main, where the owner allows it. When in doubt, branch. A branch costs nothing; a broken main costs everyone.

A branch is short lived. It exists for one piece of work and is merged or deleted within days, not weeks. The longer a branch lives, the further it drifts from main and the worse the merge, so keep the work small enough to land soon, and land the finished part rather than waiting for the whole. A branch that has been alive for more than a week is a question in NOW.md's Watch out, not a fact.

A branch is named after who holds it and the issue it is for: `claude/123-menu-surface`, `codex/207-export-page`. The first part says which agent or person to ask. The number is the issue, and the words are its title shortened. No dates, no branch called `fix` or `wip`, and no branch without an issue; see the [issues rule](issues.md).

## When to use a worktree

A worktree is a second checkout of the same repository in another folder, sharing one history. Use one when two pieces of work must run at the same time on one machine: the owner keeps {{PROJECT}} running from main while an agent builds on a branch, or two agents build two branches side by side. Do not make a worktree for work that could simply be a branch checked out in turn.

Keep every worktree in one folder the owner chooses, and say where in NOW.md's Watch out. Remove a worktree with `git worktree remove` when its branch lands. Two things about worktrees cost days when forgotten: they share one git, so deleting a branch from any worktree deletes it everywhere; and a worktree does not carry ignored files, such as local data or installed packages.

## Commits

Every commit is one change with one reason, and its message says both: a type, a short line in the present tense, and a body when the line is not enough. The types are `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf` and `ci`, from Conventional Commits. `fix: the export dialog closes on Escape` is a message; `updates` is not. The body says why, not what; the diff already shows what.

Run the checks before you commit, not after. A commit is a claim that you ran the checks in [checking your work](checking-your-work.md) for what you touched. Never chain a test run and a commit in one command; read the result first. Never rewrite history that has been pushed.

## How a feature reaches main

1. **Take a batch, not a step.** Group related issues, by their area label or on the board, and do them together on one branch.
2. **Use the feature yourself before anyone else does.** Run {{PROJECT}} from your branch, use the thing the way a person would, look at the result, and keep going until it does what was asked. Tests passing is not the feature working.
3. **Hand it to the owner to try,** with the batch listed: what to do and what should happen, one line each. The owner's try is the test that counts.
4. **On the owner's word, merge and push.** Bring main in first, merge with a merge commit, delete the branch. A pull request is optional: open one when the explanation is worth keeping, and skip it when the commit messages say enough.
5. **Update the documentation once, when the batch lands,** and close its issues with a line saying what was verified.

A second reader is kept for one kind of change: anything that touches permissions, credentials, what an agent may do unattended, or whether data survives a crash. There a fresh session reads the whole diff and runs the tests before the merge.

## Merging

Bring main into the branch first, resolve any conflict there, and run the checks again, so the merge itself is tested before it lands. Merge with a merge commit that names the branch and the work. Do not squash a branch whose commits each mean something, and do not rebase a branch that anyone else has pulled. Delete the branch once it is merged, so the branch list stays a list of live work.

## What never happens

- A force push to anything shared.
- A push to main the owner has not said yes to.
- A change to permissions, credentials, unattended actions or data safety merged without a second reader who ran it.
- A branch kept alive for weeks as a place to put things.
- A feature branch that carries an unrelated cleanup along with it.
- Secrets in a commit. If one lands, it is rotated, not only deleted from the history.

## Where this came from

Trunk-based development and short-lived branches, from trunkbaseddevelopment.com and the DORA research summarised in *Accelerate*. GitHub flow, from GitHub's own guide. Commit messages, from the Conventional Commits specification. Small changes and the reviewer's standard, from Google's engineering practices guide. Worktrees, from the git documentation.
