---
description: Execute release workflow
argument-hint: [version-number]
allowed-tools: Bash(*), Read, Grep
---

# Release Workflow: v$1

## Step 1: Pre-release Validation
Verify the codebase is ready for release:
- !`git status` — working tree clean?
- !`git log --oneline main..HEAD` — commits to release?
- !`{{test_command}}` — all tests passing?
- !`{{lint_command}}` — lint clean?
- !`{{typecheck_command}}` — type-check clean?

## Step 2: Changelog
Review commits since last release and draft changelog:
!`git log --oneline $(git describe --tags --abbrev=0)..HEAD`

Categorize changes:
- **Features**: New capabilities
- **Fixes**: Bug corrections
- **Breaking Changes**: API/behavior changes requiring migration
- **Chores**: Dependency updates, tooling changes

## Step 3: Version Bump
Update version in relevant files (package.json, pyproject.toml, etc.)

## Step 4: Final Checks
- Run full test suite one more time
- Verify build artifacts are generated correctly
- Review the changelog for accuracy

## Step 5: Report
Summarize:
1. Version: v$1
2. Changes included (count by category)
3. Breaking changes (if any)
4. Next steps (tag, push, deploy)
