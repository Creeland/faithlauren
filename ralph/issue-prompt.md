# YOUR TASK

You have been assigned exactly ONE GitHub issue, provided at the start of context as JSON (number, title, body, comments). Recent commits are also provided so you can see what prior iterations did.

Work ONLY on this issue. Do not pick up, plan, or touch any other issue.

# EXPLORATION

Explore the repo as needed to understand the code relevant to the issue. Read the issue comments — a previous iteration may have left notes on partial progress.

# IMPLEMENTATION

Complete the task described in the issue.

# FEEDBACK LOOPS

Before committing, run the feedback loops:

- `pnpm run test` to run the tests
- `pnpm run typecheck` to run the type checker

# COMMIT

Make a git commit. The commit message must:

1. Include key decisions made
2. Include files changed
3. Blockers or notes for next iteration

Do NOT push, do NOT comment on or close the issue, and do NOT use `gh` — you have no GitHub credentials here. The outer loop pushes your commits and comments on/closes the issue based on your verdict below.

NEVER run `git clean`, `git reset --hard`, `git checkout .`, or anything else that discards uncommitted or untracked files. This workspace is the user's live working directory; untracked files here belong to them and are not recoverable.

# VERDICT

This determines whether the loop closes the issue, so do it last and do it reliably. End your FINAL message with exactly this block, and nothing after it:

STATUS: COMPLETE
SUMMARY: <what was done, key decisions, anything worth noting>

or, if the issue is not fully done or you are blocked:

STATUS: INCOMPLETE
SUMMARY: <what was done, what remains, what blocked you>

Everything from `SUMMARY:` to the end of your message is posted verbatim as a GitHub comment on the issue, so write it for a human reader.
