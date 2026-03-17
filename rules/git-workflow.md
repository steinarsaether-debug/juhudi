# Git Workflow

## Branch Naming
- `feat/short-description` — new features
- `fix/short-description` — bug fixes
- `chore/short-description` — maintenance, dependencies
- `docs/short-description` — documentation only
- `refactor/short-description` — code restructuring (no behavior change)

## Commit Messages
Use conventional commits format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`

Examples:
- `feat(auth): add JWT refresh token rotation`
- `fix(api): handle null response from upstream service`
- `chore(deps): upgrade express to 4.19.2`
- `docs(readme): add deployment instructions`

## Pull Request Process
1. Create feature branch from `main`
2. Make atomic commits (one logical change per commit)
3. Write/update tests for changes
4. Run `lint + type-check + test` locally before pushing
5. Open PR with clear description:
   - What changed and why
   - How to test
   - Screenshots (for UI changes)
6. Request review (Claude Code can do first-pass via `/review-pr`)
7. Address review feedback
8. Squash merge to main

## PR Size Guidelines
- Ideal: < 300 lines changed
- Acceptable: < 500 lines
- Needs splitting: > 500 lines (unless unavoidable migration)

## Code Review with Claude Code
Use the automated PR review workflow:
- Claude checks formatting, test coverage, security
- Human reviewer focuses on architecture and business logic
- Both must approve before merge

## Protected Branches
- `main` — production; requires PR + passing CI + review
- Never force push to `main`
- Never commit directly to `main`
