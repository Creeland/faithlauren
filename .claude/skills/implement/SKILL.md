---
name: implement
description: Implement a task or unit of work through plan → build → verify → commit. Use when user says "implement", "build this", references a plan/PRD phase, or asks to work on a feature or fix.
---

# Implement

## Workflow

### 1. Plan (skip if plan/PRD provided)

- Read any referenced plan or PRD in `plans/` or `prd/`
- If no plan exists, create a brief one:
  - What changes are needed and where
  - Acceptance criteria (checkboxes)
  - Files to touch
- Confirm plan with user before proceeding

### 2. Build (Red-Green-Refactor)

For each change, follow the red-green-refactor cycle:

Use this TDD technique only for back-end code.

1. **Red** — Write a failing test that defines the expected behavior
2. **Green** — Write the simplest code that makes the test pass
3. **Refactor** — Clean up the code while keeping tests green

- Run the relevant test after each step to confirm state (failing → passing → still passing)
- Keep cycles small — one behavior per loop
- If no test framework is set up, ask the user before skipping tests
- Do this in a tracer bullet format, one test at a time, one change at a time.

### 3. Verify

- Run `npm run build` to catch type/build errors
- Run tests if they exist: `npm test`
- Fix any failures before proceeding
- Walk through acceptance criteria and confirm each is met

### 4. Commit

- Use `/commit` to commit the work
- Commit message should reference the plan/phase if applicable
