# Working with the owner

The owner is the person who directs the work, judges the result, and decides. Today that is {{OWNER}}, named once in the [README](../README.md). These are the standing rules for working with whoever holds that role. Only rules that change what an agent does are here, each with the date it was set.

The rules below came with this documentation, from the project it was first built for, and each is marked "from setup". Go through them with the owner: keep what they want, rewrite what they want differently, and remove the rest. Then replace each mark with the date the owner confirmed it.

Agents: when the owner corrects you, or states a preference that will matter again, add it here in the same sitting, in the owner's own words where you can, with the date. Do not keep it in your private memory, where no other harness can read it.

## Talking to the owner

- **Plain language.** Short sentences, one idea each, the same word for the same thing. Explain what a thing is before saying anything about it. No invented metaphors, no agent jargon, no bare codes or numbers standing in for a thing. (from setup)
- **Lead with the answer.** Then the reasons, briefly. (from setup)
- **When the owner asks a question back, answer it and wait.** (from setup)
- **An issue or pull request number is always a link, with its title on it.** Write `[#12]({{ISSUES}}/12 "The title of the issue")`, never a bare `#12`, in chat and in these pages, so hovering shows what it is and clicking opens it. (from setup)

## What the owner decides

- **Scope.** Nothing new joins the product on an agent's judgement. Ask, with a recommendation, and wait. (from setup)
- **Anything spent, sent, published or deleted,** and anything about keeping or losing data. (from setup)
- **How things look.** When the owner says something looks wrong, wait for what they want. A dislike is not a design. (from setup)

## What an agent decides

- **Technical choices with a known convention.** See how the field does it, decide, and record the decision in `decisions/` with its evidence and what would reverse it. (from setup)
- **Whether a plan is ready.** The session directing the work gives the verdict and owns it. (from setup)

## Building

- **Before starting a feature, give the rundown and wait.** Say in short form what already exists, what is missing, and what you want to build in this batch. The owner says ok, or questions the plan first. Nothing is built before one of those. (from setup)
- **Several things named means all of them,** built straight through, reported once at the end in the order they were named. (from setup)
- **No stubs and no placeholders.** Work ships complete or not at all. (from setup)
- **Verify in proportion.** Small confident changes ship on the tests near them and a look at the result. The full suite runs after large work, or where only it would catch the fault. (from setup)
- **Another agent's delivery is a claim.** Run the checks yourself before trusting it. (from setup)

## Commits and pushing

- **This documentation repository is pushed freely.** Stage only your own files. (from setup)
- **The code repository is pushed only on the owner's word.** (from setup)

## Closed. Do not reopen.

- None yet.
