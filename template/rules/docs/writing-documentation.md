# Writing documentation

How a page in `docs/` is written, so that any agent can read it, trust it and update it. Each rule carries its reason, because a rule is followed better when the reason is known.

## The shape of a page

Every page has one title and these six headings, in this order. The check fails on anything else. Start from the [page template](page-template.md).

| Heading | What goes under it |
|---|---|
| What it is | Two or three plain sentences. The first two become the glossary entry, so they must stand on their own. |
| How it works | The short version, as numbered steps where order matters. |
| Where it lives | A list of the files and folders, each in backticks, written from the root of the code repository. |
| Related | Links to the pages this one touches. |
| Decisions | Links to the decisions that shaped it. Write "None recorded." when there are none. |
| Last checked | The date you last checked the page against the code, written like 2026-09-17. |

The title is the term. Whatever you put in the title is the word everyone uses for the thing.

## The ten rules

1. **One page, one topic. At most 150 lines.** Agents read whole files. A small page is cheap to read and hard to misread, and two agents rarely collide on it.
2. **Every page has the same headings.** The reader always knows where to look. The writer always knows where to write.
3. **Write what is true now. Replace, never append.** No dates of events, no "we changed this". When something changes, rewrite the sentence. History lives in `decisions/`, in `archive/` and in git.
4. **Lead with the answer.** The first two sentences say what the thing is.
5. **Short plain sentences, one fact each.** An agent can then update one fact without rewriting a paragraph.
6. **One word per thing.** Use the title of the page that owns the term, exactly, every time. Two words for one thing reads as two things, and the second one gets built. Words we stopped using are in [retired words](retired-words.md). The check fails on them.
7. **Point, do not copy.** A fact lives on one page. Every other page links to it. Give a file path instead of pasting code. Anything copied goes stale in one of its two places.
8. **Do not repeat what the code already says.** Say what the thing is for, why it is built that way, and what would surprise someone. The reader can open the code for the rest.
9. **Full real paths.** Written from the root of the code repository, such as `src/server/routes`. The check confirms each one exists on the branch of the code named in `docs.config.json`, which is main.
10. **Say when you are not sure.** Write "Not verified" rather than a confident guess. Keep what it does today apart from what it is meant to do.

## Adding a page

1. Find the chapter it belongs to in the [table of contents](../../TABLE-OF-CONTENTS.md).
2. Copy the [page template](page-template.md) into that chapter. Name the file after the thing, in lowercase with hyphens, such as `sign-in.md`.
3. Fill in all six headings. Check every path against the code.
4. Run `npm run build`. The chapter's page list, the table of contents and the glossary update themselves.
5. Run `npm run check`.

Something you can see that also has an engine underneath gets two pages, one in each chapter. The first says what you see. The second says how it works. Each links to the other.

A chapter that passes about a dozen pages is split in two.

## Changing a page

1. Rewrite the sentences that are no longer true.
2. Check that every path under Where it lives still exists.
3. Set Last checked to today.

Do not add a note saying what changed. The commit message says that.

## What you never edit by hand

The table of contents, the glossary, and the page list between the `generated` markers inside each chapter's README. They are built from the pages. You may edit the title and the opening sentence of a chapter README, above the markers.

## Writing for the owner too

the owner reads these pages. Write so that someone who does not program can follow What it is and the first lines of How it works. Expand an acronym the first time it appears. Keep file names and code words out of What it is where you can.
