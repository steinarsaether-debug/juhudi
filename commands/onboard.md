---
description: Onboard to a codebase or module
argument-hint: [module-or-area-to-learn]
allowed-tools: Read, Grep, Glob, Bash(git:*)
---

# Codebase Onboarding: $1

## Step 1: Read Project Context
Read the project's CLAUDE.md and architecture docs:
- `CLAUDE.md` for project overview and conventions
- `docs/architecture.md` for system design
- `docs/onboarding.md` for team-specific context

## Step 2: Map the Module
For the requested area ($1), identify:
- **Entry points**: Where does execution start?
- **Key files**: What are the most important files?
- **Dependencies**: What does this module depend on?
- **Dependents**: What depends on this module?
- **Data flow**: How does data move through this area?

## Step 3: Identify Patterns
Review 2-3 representative files and document:
- Coding patterns used (design patterns, conventions)
- Error handling approach
- Testing approach
- Configuration mechanism

## Step 4: Find Related Resources
- Recent git history: `git log --oneline -20 -- [relevant-path]`
- Related tests: find test files for this module
- Related documentation: any docs referencing this area

## Step 5: Summary
Provide a concise onboarding brief:
1. **What it does** (2-3 sentences)
2. **Key files** (top 5-10 files to read)
3. **Architecture diagram** (text/mermaid)
4. **Common tasks** (how to add features, fix bugs in this area)
5. **Gotchas** (non-obvious things that trip people up)
