# Project: {{PROJECT_NAME}}

## Overview
{{One-two sentence description. What does this project do? Who uses it?}}

## Quick Commands
- Build: `{{build_command}}`
- Test: `{{test_command}}`
- Lint: `{{lint_command}}`
- Dev server: `{{dev_command}}`
- Type check: `{{typecheck_command}}`

## Architecture
- @docs/architecture.md for full system design
- @docs/onboarding.md for new contributor guide

## Critical Rules

### Code Quality
- NEVER use type suppression (`as any`, `@ts-ignore`, `@ts-expect-error`)
- NEVER commit secrets, `.env` files, or credentials
- NEVER leave empty catch blocks — always handle or re-throw
- NEVER delete failing tests to make CI pass

### Development Process
- ALWAYS write tests before implementation (TDD)
- ALWAYS run lint + type-check before committing
- ALWAYS verify changes with `lsp_diagnostics` on modified files
- Fix root causes, not symptoms — no shotgun debugging

### Code Style
- Prefer immutability — avoid object mutation
- Max 400 lines per file (hard limit: 800)
- Organize by feature, not by type
- See `.claude/rules/code-style.md` for detailed conventions

## Testing Strategy
- Unit tests alongside source: `*.test.ts` / `*.test.py`
- Integration tests in `tests/integration/`
- Minimum 80% coverage target
- Mock external services (DB, APIs, third-party)
- See `.claude/rules/testing.md` for full conventions

## Git Workflow
- Branch naming: `feat/`, `fix/`, `chore/`, `docs/`
- Commit format: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- PR requirement: tests pass + review approved
- Squash merge to main
- See `.claude/rules/git-workflow.md` for full process

## Key Patterns
{{Document your project-specific patterns here:}}
- Error handling: {{describe your error class hierarchy}}
- API responses: {{describe your standard response format}}
- State management: {{describe your state approach}}
- Authentication: {{describe your auth flow}}

## External Dependencies
{{List key external libraries and link to their docs:}}
- {{library1}}: [docs]({{url}})
- {{library2}}: [docs]({{url}})
