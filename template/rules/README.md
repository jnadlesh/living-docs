# Rules

How work is done on {{PROJECT}}. One page sits at the top, and the rest are grouped by what they govern, one folder per subject. When a new kind of work needs its own rules, such as the code or the UI, it gets its own folder here.

## Read first

| Page | What it is |
|---|---|
| [Working with the owner](working-with-the-owner.md) | The standing rules for working with the person who directs the work and decides. |

## By subject

| Folder | What it governs | Pages |
|---|---|---|
| [docs/](docs/) | This documentation: how to use it, how to write it, the shapes a page and a task file take, and the words that were retired. | [using the documentation](docs/using-the-documentation.md), [writing documentation](docs/writing-documentation.md), [page template](docs/page-template.md), [task template](docs/task-template.md), [retired words](docs/retired-words.md) |

## Adding a rule

A rule goes on the page for its subject. A new subject gets a new folder with its own pages, and a row in the table above. A rule is a thing a check can catch or a reviewer can point at, not a story about something that happened once; stories go in the archive. Every rules page is held to the same length as any other page, 150 lines, by `npm run check`.
