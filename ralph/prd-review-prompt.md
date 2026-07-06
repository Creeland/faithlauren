# YOUR TASK

You have been assigned exactly ONE PRD (Product Requirements Document) to REVIEW, provided at the start of context as JSON (number, title, body, comments), along with the list of child issues that were spawned from it. All child issues are closed; your job is to verify that the PRD as a whole is actually satisfied by the codebase.

This is a review, not an implementation task. Do NOT write code, do NOT commit, and do NOT pick up other issues.

# REVIEW

- Read the PRD body carefully: goals, requirements, acceptance criteria, user stories.
- Read the PRD's comments — earlier reviews may have flagged gaps; check whether they were addressed since.
- Explore the codebase and verify each requirement and acceptance criterion against the ACTUAL code. Do not trust that a closed child issue means its work landed — confirm it in the code.
- Run the feedback loops: `pnpm run test` and `pnpm run typecheck`.

Do NOT use `gh` — you have no GitHub credentials in this sandbox. The outer loop comments on and closes the PRD based on your verdict below.

NEVER run `git clean`, `git reset --hard`, `git checkout .`, or anything else that discards uncommitted or untracked files. This workspace is the user's live working directory; untracked files here belong to them and are not recoverable.

# VERDICT

This determines whether the loop closes the PRD, so do it last and do it reliably. End your FINAL message with exactly this block, and nothing after it:

STATUS: COMPLETE
SUMMARY: <review report: each requirement and how the code satisfies it, plus test/typecheck results>

or, if the PRD is not fully satisfied:

STATUS: INCOMPLETE
SUMMARY: <gap report: each unmet requirement, what exactly is missing, written as actionable items that follow-up issues could be spawned from>

Everything from `SUMMARY:` to the end of your message is posted verbatim as a GitHub comment on the PRD, so write it for a human reader.
