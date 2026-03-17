# Security Rules

## Secrets Management
- NEVER hardcode secrets, API keys, tokens, or passwords
- NEVER commit `.env`, `credentials.json`, or similar files
- Use environment variables for all sensitive configuration
- Use secret managers (AWS Secrets Manager, Vault) in production

## Input Validation
- Validate ALL external input at system boundaries
- Use schema validation (Zod, Joi, Pydantic) — not manual checks
- Parameterized queries ONLY — never string interpolation for SQL
- Sanitize user input before rendering (XSS prevention)

## Authentication & Authorization
- Verify auth on every request — no "trusted" internal routes
- Use principle of least privilege for service accounts
- Rotate secrets and tokens regularly
- Log auth failures for monitoring

## Dependencies
- Review new dependencies before adding (check maintenance, security advisories)
- Pin dependency versions in production
- Run `npm audit` / `pip audit` regularly
- Avoid dependencies with known vulnerabilities

## Code Review Security Checklist
Before approving any PR, verify:
- [ ] No hardcoded secrets or credentials
- [ ] Input validation at boundaries
- [ ] Parameterized database queries
- [ ] Proper error messages (no stack traces in production)
- [ ] Authentication/authorization checks present
- [ ] No sensitive data in logs

## Hooks Integration
The `.claude/hooks.json` includes a PreToolUse hook that scans for secrets
before any file write operation. This catches accidental secret commits
during AI-assisted development.
