# Checking your work

How to run, test and inspect {{PROJECT}}, and the traps that look like success. The commands are filled in from the code repository, and each one here was run and seen to work. Things learned the hard way are added under the traps, with their date.

## The commands

Run from the root of the code repository.

| To do this | Run | What it really does |
|---|---|---|
| Install | Not recorded yet. | |
| Run {{PROJECT}} | Not recorded yet. | |
| All tests | Not recorded yet. | |
| Lint and types | Not recorded yet. | |
| The full check before a release | Not recorded yet. | |

## How much checking

- **In proportion.** A small change you are sure of ships on the tests near it and a look at the result. Run the full suite after large work, or where only it would catch the fault.
- **A check you could not run is reported as not run,** never as green.
- **Use it the way a person would.** Tests say the parts work. Running {{PROJECT}} and using the changed thing says the whole works.

## Traps that look like success

- **A test run that prints nothing has not passed.** Read the summary: how many tests ran and how many passed. A command pointed at the wrong folder can run nothing and exit cleanly.
- **Join checks with `;` when you want all their output.** With `&&` the first failure hides the rest.
- **One test through the real path.** A value passed through five layers can have a passing test at every layer and still be dead in the real product, because the first layer never sent it. For anything that crosses layers, one test starts at the real producer and checks what the far end receives.
- **A reviewer must run the thing.** Reading finds some faults; running the changed code against the real checks finds more. Reject any fake used in tests that is looser than the real thing it stands in for.
- **Check another agent's delivery yourself.** A handoff that says green is a claim until you have run the checks.
- **Stop only what you started.** Several agents may share one machine. Keep the id of each process you start and stop that one, never every process with the same name.
