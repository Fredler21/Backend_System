# Contributing to Edlight Initiative Backend

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create a branch** for your feature or fix
4. **Make your changes** following the guidelines below
5. **Test** your changes thoroughly
6. **Submit** a pull request

## Branch Naming Convention

Use descriptive branch names with prefixes:

- `feature/` — New features (e.g., `feature/course-module`)
- `fix/` — Bug fixes (e.g., `fix/token-refresh-race-condition`)
- `docs/` — Documentation updates (e.g., `docs/api-examples`)
- `refactor/` — Code refactoring (e.g., `refactor/auth-middleware`)
- `test/` — Test additions or updates (e.g., `test/user-service`)

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting, semicolons, etc.) |
| `refactor` | Code refactoring (no feature or fix) |
| `test` | Adding or updating tests |
| `chore` | Build process or tooling changes |

### Examples

```
feat(auth): add refresh token rotation
fix(users): handle duplicate email on profile update
docs(readme): update API reference table
test(auth): add login validation tests
```

## Code Style

- **TypeScript** with strict mode enabled
- **Prettier** for formatting — run `npm run format` before committing
- **ESLint** for linting — run `npm run lint` to check for issues
- Use meaningful variable and function names
- Add JSDoc comments to exported functions
- Keep functions small and focused

## Testing

- Write tests for all new features and bug fixes
- Maintain existing test coverage
- Run the full test suite before submitting: `npm test`
- Integration tests go in the `tests/` directory
- Unit tests go alongside their module (`*.test.ts`)

## Pull Request Process

1. Ensure your PR targets the `main` branch
2. Fill out the PR template completely
3. Link any related issues
4. Ensure all CI checks pass
5. Request review from at least one maintainer
6. Address all review feedback

## Development Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev

# Run tests
npm test
```

## Questions?

Open an issue with the `question` label and we'll get back to you.
