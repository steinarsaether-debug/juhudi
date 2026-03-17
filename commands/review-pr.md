---
description: Comprehensive PR review workflow
argument-hint: [pr-number]
allowed-tools: Bash(gh:*), Read, Grep, Glob
---

# PR Review: #$1

## Step 1: Fetch PR Details
!`gh pr view $1 --json title,body,author,baseRefName,headRefName,additions,deletions,changedFiles`

## Step 2: Review Changed Files
Files changed: !`gh pr diff $1 --name-only`

For each changed file, check:
- [ ] Code quality and readability
- [ ] Type safety (no `as any`, `@ts-ignore`)
- [ ] Error handling (no empty catch blocks)
- [ ] Tests exist for new/changed behavior
- [ ] No hardcoded secrets or credentials
- [ ] Input validation at boundaries
- [ ] Documentation updated if needed

## Step 3: Check CI Status
!`gh pr checks $1`

Verify:
- All tests passing
- No merge conflicts
- Lint and type-check clean

## Step 4: Review Against Project Rules
Cross-reference changes against:
- `.claude/rules/code-style.md`
- `.claude/rules/security.md`
- `.claude/rules/testing.md`

## Step 5: Provide Feedback
Summarize findings:
1. **Critical issues** (must fix before merge)
2. **Suggestions** (nice to have, non-blocking)
3. **Positives** (what was done well)
4. **Approval recommendation** (approve / request changes / comment)
