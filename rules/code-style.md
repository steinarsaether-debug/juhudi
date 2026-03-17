# Code Style Guidelines

## Naming Conventions
- **Variables/functions**: camelCase (`getUserById`, `isActive`)
- **Classes/types/interfaces**: PascalCase (`UserService`, `ApiResponse`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`, `API_BASE_URL`)
- **Files**: kebab-case (`user-service.ts`, `api-handler.ts`)
- **Test files**: `[name].test.ts` alongside source file

## File Organization
- Organize by feature, not by type
- Max 400 lines per file (hard limit: 800)
- One exported class/component per file
- Group imports: external → internal → relative

```
// 1. External dependencies
import { z } from 'zod';
import express from 'express';

// 2. Internal absolute imports
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/errors';

// 3. Relative imports
import { validateInput } from './validators';
import type { UserDTO } from './types';
```

## Type Safety
- NEVER use `as any`, `@ts-ignore`, or `@ts-expect-error`
- Prefer `unknown` over `any` — narrow with type guards
- Use discriminated unions over optional fields when modeling state
- Define explicit return types for public functions

## Immutability
- Prefer `const` over `let`, never use `var`
- Use spread/destructuring instead of mutation
- Prefer `readonly` arrays and properties where possible
- Use `Object.freeze()` for configuration objects

## Error Handling
- NEVER use empty catch blocks `catch(e) {}`
- Always handle or re-throw with context
- Use custom error classes extending a base AppError
- Log errors with structured context (not just `console.log(e)`)

## Functions
- Single responsibility — one function does one thing
- Max 3 parameters — use an options object beyond that
- Prefer pure functions where possible
- Document non-obvious behavior with JSDoc

## Comments
- Don't comment WHAT, comment WHY
- Use JSDoc for public API documentation
- Remove commented-out code — use git history instead
- TODO format: `// TODO(username): description (#issue-number)`
