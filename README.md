# Living docs

A skill that sets up and runs a living documentation repository beside a code repository. Every agent, in any harness, reads the same current facts before it works, and writes back what changed before its work counts as done.

- `SKILL.md` is what an agent reads.
- `setup.mjs` creates a documentation repository for a project. Run `node setup.mjs` with no arguments to see what it needs.
- `template/` is the blank documentation repository, with the tools that build its indexes and check its rules.
- `pointers/` holds the short blocks that setup adds to `AGENTS.md`, so an agent that opens the code finds the documentation.

Run the tests with `npm test`. It was first built for a desktop application called Aurelia, which is its first user.
