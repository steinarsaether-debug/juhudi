---
description: Start TDD workflow for a new feature
argument-hint: [feature-description]
allowed-tools: Read, Write, Edit, Bash(npm:*), Bash(npx:*), Grep, Glob
---

# TDD Workflow: $1

Follow this process strictly:

## Step 1: Understand the Requirement
Read any relevant spec, design doc, or existing code for context.

## Step 2: Write Pseudocode
Draft pseudocode outlining the approach. Show it before proceeding.

## Step 3: Write Failing Tests
Write comprehensive test cases FIRST — they should all FAIL initially:
- Happy path cases
- Edge cases (empty input, boundaries)
- Error cases (invalid input, failures)

Run the tests to confirm they fail: `{{test_command}}`

## Step 4: Implement Minimal Code
Write the minimum code to make each test pass, one at a time.
After each test passes, run the full suite to check for regressions.

## Step 5: Refactor
With all tests green, refactor for clarity and performance.
Run tests after each refactor to ensure nothing breaks.

## Step 6: Report
Summarize:
- Tests written and passing
- Coverage for changed files
- Any edge cases discovered during implementation
- Suggestions for additional tests
