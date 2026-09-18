# {{PROJECT}} documentation

This repository is the single source of truth for {{PROJECT}}. Every agent reads it before working and updates it when finished. That holds for any harness, one agent or ten.

Start with [NOW.md](NOW.md) to see what is happening today.

## What every folder is

| Where | What it holds |
|---|---|
| [TABLE-OF-CONTENTS.md](TABLE-OF-CONTENTS.md) | The sections that explain how {{PROJECT}} works. Start here to look something up. |
| [GLOSSARY.md](GLOSSARY.md) | Every term, short, with a link to its page. |
| [NOW.md](NOW.md) | Where the work is today. One screen. |
| `docs/` | How {{PROJECT}} works today, in numbered sections. One page per thing. |
| [decisions/](decisions/README.md) | Why things are the way they are. Numbered, never edited, only superseded. |
| [work/](work/README.md) | What is being built right now. One file per task. |
| [rules/](rules/README.md) | [Working with the owner](rules/working-with-the-owner.md), then one folder per subject, starting with `docs/` for this documentation. The owner of {{PROJECT}} is {{OWNER}}. |
| [reference/](reference/README.md) | Pictures and research. Background, not truth. |
| [archive/](archive/README.md) | No longer true. Never read it to learn how {{PROJECT}} works. |
| `tools/` | The scripts that build the indexes and check the rules. |

## The two promises

1. Read first. Before you build anything, look it up. If a page exists, the thing exists: use it, do not build it again. If no page exists, it is new, and building it includes writing its page.
2. Write back. No work is done until the documentation is updated. Whoever lands the work updates the pages it changed and [NOW.md](NOW.md).

How to do both is in [using the documentation](rules/docs/using-the-documentation.md). How to write a page is in [writing documentation](rules/docs/writing-documentation.md).

## Looking something up

1. Open [TABLE-OF-CONTENTS.md](TABLE-OF-CONTENTS.md) and pick the section you need.
2. That section has its own table of contents. It lists every page, what the thing is in one line, and where it lives in the code. Often that is all you need.
3. Open the page for how it works and why.

If you do not know a word, open [GLOSSARY.md](GLOSSARY.md).

## Checking your work

```
npm run build    rebuild the table of contents, the glossary, the section tables and the decisions list
npm run check    check every rule, that every listed code path still exists,
                 and warn about pages whose code changed since they were last checked
npm run find -- island              look something up in one step
npm run pages-for -- main..branch   which pages a change to the code touches
npm test         test the tools themselves
```

The table of contents, the glossary, the table inside each section and the list of decisions are built from the files. Never edit them by hand.
