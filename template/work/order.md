# The order

The owner's order for the work. Every piece of work is a [GitHub issue]({{ISSUES}}); this page says which issues come first. It is not a tracker. How an issue is written and worked is the [issues rule](../rules/code/issues.md).

## The tiers

1. **1 Bugs and usability**: what is broken, and what makes {{PROJECT}} usable today.
2. **2 Finish what is half built**: work that was started, finished before anything new begins.
3. **3 Later**: everything else, not yet ordered.

## How it is kept

Each tier is a milestone on GitHub with exactly the name in bold, and every internal issue has one. An idea has no milestone until it is promoted to a feature. An issue from a user has none until someone triages it.

Work in a lower tier does not start while a higher tier has open issues that could be done, unless the owner says so. Within a tier, issues are not ranked unless the owner ranks them, on the project board when there is one.

The owner sets the tiers. To add one, write it here as a numbered line with its name in bold, then run `npm run github` so the milestone exists. To rename one, change it here and rename the milestone on GitHub by hand, on the owner's word. Moving an issue between tiers is the owner's call, or an agent's with the owner's words to point at.
