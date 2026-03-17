# Testing Conventions

## Philosophy: Test-Driven Development (TDD)
Follow the Anthropic Security Engineering pattern:
1. Write a design doc or spec
2. Generate pseudocode from the spec
3. Write failing tests FIRST
4. Implement minimal code to pass tests
5. Refactor while keeping tests green
6. Human reviews at each checkpoint

## Test Structure
- Unit tests: alongside source in `*.test.ts` / `*.test.py`
- Integration tests: in `tests/integration/`
- E2E tests: in `tests/e2e/`
- Fixtures/mocks: in `tests/fixtures/`

## Naming
- Test files: `[module].test.ts`
- Describe blocks: match the module/function name
- Test names: `it('should [expected behavior] when [condition]')`

```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create a user with valid input', async () => { ... });
    it('should throw ValidationError when email is missing', async () => { ... });
    it('should not create duplicate users', async () => { ... });
  });
});
```

## Coverage
- Minimum 80% coverage target
- Critical paths (auth, payments, data mutations): 95%+
- Coverage is a floor, not a ceiling — test behavior, not lines

## Mocking
- Mock external services (DB, APIs, third-party)
- Never mock the unit under test
- Use dependency injection to make mocking easy
- Reset mocks between tests (`beforeEach`/`afterEach`)

## What to Test
- Happy paths (expected input → expected output)
- Edge cases (empty input, null, boundary values)
- Error paths (invalid input, network failures, timeouts)
- State transitions (before/after side effects)

## What NOT to Test
- Third-party library internals
- Private methods directly (test through public API)
- Implementation details (test behavior, not structure)
- Simple getters/setters with no logic

## Autonomous Testing Loop
When using Claude Code for testing (Product Design pattern):
1. Give Claude the feature spec
2. Claude writes tests → runs them → iterates
3. Human reviews passing test suite
4. Human reviews implementation
5. Final refinements with human guidance
