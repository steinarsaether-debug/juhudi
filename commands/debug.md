---
description: Debug a production issue or error
argument-hint: [paste-error-or-describe-issue]
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(curl:*), Bash(npm:*), Bash(docker:*)
---

# Debug: $1

## Step 1: Analyze the Error
Parse the error message, stack trace, or behavior description.
Identify:
- Error type and message
- File and line number (if available)
- Call chain / stack trace path

## Step 2: Trace Control Flow
Starting from the error location, trace backwards through the codebase:
- What function threw the error?
- What called that function?
- What input triggered this path?
- Are there any recent changes that could have caused this? Check: `git log --oneline -10`

## Step 3: Identify Root Cause
Determine the actual root cause (not just the symptom):
- Is it a data issue? (null, undefined, wrong type)
- Is it a logic issue? (wrong condition, missing case)
- Is it an integration issue? (API change, config drift)
- Is it a concurrency issue? (race condition, deadlock)

## Step 4: Propose Fix
Provide a MINIMAL fix that addresses the root cause:
- Do NOT refactor while fixing
- Do NOT fix unrelated issues
- Include a test that would have caught this bug

## Step 5: Prevention
Suggest how to prevent recurrence:
- Additional validation or type checking
- Better error handling
- Monitoring or alerting
- Documentation update
