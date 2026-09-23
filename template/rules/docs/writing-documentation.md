# Writing documentation

How a page in `docs/` is written. The test of a page is simple: a person who does not program should be able to read it and understand the thing, and an agent should get exactly the same understanding from the same words. There is no separate agent version. Each rule below carries its reason, because a rule is followed better when the reason is known.

## Write like a person explaining something

Write the page the way you would explain the thing to a colleague across a desk: in paragraphs, in full sentences, in the order a listener would need. Say what the thing is, then how it behaves, then why it is built that way, then what would surprise someone. A page is an explanation, not a specification and not a list of facts.

That means:

- Paragraphs, not bullet points. A bullet list is for things that really are a list: the files under Where it lives, the links under Related. Everything else is prose.
- Numbered steps only for a sequence that actually happens in order, such as what happens when a person presses save. Ten numbered points that are each a separate fact are not steps; write them as paragraphs.
- No fragments. "Growing text field, + menu, / menu" is a note to yourself. "The text field grows as you type, and two menus sit beside it" is a sentence.
- Code words and file paths stay out of the explanation. Say "the sign-in screen", not `sign-in-form.tsx`; the file belongs under Where it lives. Expand an abbreviation the first time it appears.
- Tables are for numbers and for many items of the same shape, such as a list of commands. A table is never a substitute for explaining.
- Plain words. The same word for the same thing every time, the word being the title of the page that owns it. Words we stopped using are in [retired words](retired-words.md), and the check fails on them.

A good check: read the page aloud. If it sounds like a person talking, it is right. If it sounds like a form being filled in, rewrite it.

## The shape of a page

Every page has one title and six headings, in this order. The check fails on anything else. Start from the [page template](page-template.md). The headings are there so a reader always knows where to look and a writer always knows where to write. What goes under them is prose, as above.

Under **What it is**, two or three sentences that say what the thing is and what it is for. The first two become the glossary entry, so they must stand on their own. Under **How it works**, the explanation: how it behaves, why, and the things that would surprise someone. Under **Where it lives**, the files and folders, each in backticks, written from the root of the code repository, with a few words on what each one holds. Under **Related**, links to the pages this one touches, each with a few words on why. Under **Decisions**, links to the decisions that shaped it, or "None recorded." Under **Last checked**, the date you last checked the page against the code, written like 2026-09-17.

The title is the term. Whatever you put in the title is the word everyone uses for the thing.

## The rules that keep a page true

1. **One page, one topic, at most 150 lines.** Agents read whole files. A small page is cheap to read and hard to misread, and two agents rarely collide on it.
2. **Write what is true now. Replace, never append.** No dates of events, no "we changed this". When something changes, rewrite the sentence. History lives in `decisions/`, in `archive/`, in the closed issues and in git.
3. **Lead with the answer.** The first two sentences say what the thing is.
4. **Point, do not copy.** A fact lives on one page. Every other page links to it. Give a file path instead of pasting code. Anything copied goes stale in one of its two places.
5. **Do not repeat what the code already says.** Say what the thing is for, why it is built that way, and what would surprise someone. The reader can open the code for the rest.
6. **Full real paths.** Written from the root of the code repository, such as `src/server/routes`. The check confirms each one exists on the branch of the code named in `docs.config.json`.
7. **Say when you are not sure.** Write "Not verified" rather than a confident guess. Keep what it does today apart from what it is meant to do.

## Adding a page

Find the section it belongs to in the [table of contents](../../TABLE-OF-CONTENTS.md). Copy the [page template](page-template.md) into that section and name the file after the thing, in lowercase with hyphens, such as `sign-in.md`. Fill in all six headings and check every path against the code. Then run `npm run build`, which updates the section's page list, the table of contents and the glossary, and `npm run check`.

Something you can see that also has an engine underneath gets two pages, one in each section. The first says what you see. The second says how it works. Each links to the other. A section that passes about a dozen pages is split in two.

## Adding a section

A section is a numbered folder under `docs/`, such as `02-the-editor`, holding a `README.md` with a title, one sentence on what the section covers, and the two `generated:pages` markers, copied from the first section. Its number sets its place in the table of contents. The folder's name without the number, and without a leading "the", is the section's area label on GitHub, so pick a short one: `02-the-editor` is `editor`. Run `npm run github` after adding one, so the label exists.

## Changing a page

Rewrite the sentences that are no longer true, check that every path under Where it lives still exists, and set Last checked to today. Do not add a note saying what changed; the commit message says that.

## What you never edit by hand

The table of contents, the glossary, the list of decisions, and the page list between the `generated` markers inside each section's README. They are built from the files. You may edit the title and the opening sentence of a section README, above the markers.
