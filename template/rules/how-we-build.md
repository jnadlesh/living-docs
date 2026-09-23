# How we build

The law for every change to {{PROJECT}}, in code or in documentation. It is short because it is meant to be kept. Every other rules page is one of these applied to one kind of work. None of it is new: it is what the field settled on, and the sources are named at the end.

## The five rules

1. **One definition.** Every value, every reusable thing and every fact has one home. A colour is a token. A shared piece of the interface is a shared part. A rule is a page here. Anything copied drifts. If you find the same thing defined twice, that is a defect: merge it and leave one.
2. **Look before you build.** Before writing anything new, look for the existing piece: the token, the part, the function, the page. `npm run find -- <words>` here, and the section tables of contents, are the first stop. If it exists, use it. If it nearly fits, extend it. Build a second one only when you can say, in one sentence, what the first cannot do.
3. **Declare what, not how.** A caller says what it needs, and the piece it calls owns how that is done. A screen asks for a menu with these items; the menu owns how a menu looks and behaves. A caller passes meaning, never appearance or internals: a choice from a small closed set, never a raw value. The same holds beyond the interface: a caller asks a service for a result and never reaches into its files.
4. **The wrong way fails.** A rule nothing checks is a wish. Every rule that a tool can check is checked by a tool, in the local checks and in the hosted checks. Where no tool can check yet, the rule says so, and adding the check is part of the work.
5. **Verify, then say so.** A change is done when it is proven: the check passed, the test ran, the page was updated, the issue says what was verified. A claim without evidence is not done. Report what was not run as not run.

## What they mean in practice

- Knowledge lives here, one page per thing. See [using the documentation](docs/using-the-documentation.md).
- Work lives in GitHub issues, one per thing, all in one shape. See [issues](code/issues.md).
- Decisions live in `decisions/`, each with its reason and what would reverse it.
- Checks live in the code repository's own checks and in this repository's `npm run check`. See [checking your work](code/checking-your-work.md).

## When a rule and the code disagree

The code is what runs. The rule is what was decided. If they disagree, one of them is wrong, and the answer is never to leave both standing. Fix the code to match the rule, or bring the disagreement to the owner and record a new decision. Do not quietly write a page that describes the wrong behaviour as if it were chosen.

## Where this comes from

- One definition: the DRY rule as first stated in The Pragmatic Programmer, "every piece of knowledge must have a single, unambiguous, authoritative representation." And its limit, the rule of three: do not abstract on the first repetition.
- Declare what, not how: the three-tier token model of Material Design, Carbon, Spectrum and Primer, where components use semantic tokens and never raw values; and headless parts such as Base UI and Radix, which own behaviour and leave appearance to a closed set of variants.
- The wrong way fails: lint rules that refuse raw values and banned patterns, and the reason the design token format was standardised, so tools can validate it.
- Verify, then say so: Anthropic's and OpenAI's own guidance for coding agents, which both say to give the agent a way to check its work and to make it run that check.
