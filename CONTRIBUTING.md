# Contributing to Performance Bottleneck Analyzer

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Build all packages: `npm run build`
4. Start dev mode: `npm run dev`

## Project Structure

This is a monorepo managed with Turbo. Each package lives under `packages/`:

| Package            | Description                                 |
| ------------------ | ------------------------------------------- |
| `browser-agent`    | Lightweight JS snippet for production sites |
| `sdk`              | TypeScript SDK for easy integration         |
| `api`              | Express backend API server                  |
| `analytics-engine` | Core analysis & regression detection        |
| `dashboard`        | React web dashboard                         |
| `vscode-extension` | VS Code extension for alerts                |
| `cli`              | Command-line interface                      |

## Development Workflow

1. Create a branch from `main`
2. Make your changes in the relevant package(s)
3. Ensure the build passes: `npm run build`
4. Ensure types are valid: `npm run type-check`
5. Run linting: `npm run lint`
6. Submit a pull request

## Code Style

- TypeScript for all packages
- Prettier for formatting (config in `.prettierrc`)
- ESLint for linting (config in `.eslintrc.json`)
- Follow existing patterns in the codebase

## Commit Messages

Use clear, descriptive commit messages:

- `feat: add LCP metric collection to browser agent`
- `fix: handle null metrics in analytics engine`
- `docs: update SDK integration guide`

## Reporting Issues

Use GitHub Issues. Include:

- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (Node version, OS, browser)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
