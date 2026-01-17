# Roto-Rooter

Static analysis and functional verifier tool for React Router applications. CLI is `rr`.

## Project Structure

- `src/cli.ts` - CLI entry point
- `src/analyzer.ts` - Main analysis orchestration
- `src/parsers/` - AST parsers for routes, components, and actions
- `src/checks/` - Individual check implementations (links, forms, loader, params, hydration)
- `src/types.ts` - Type definitions

## Commands

- `npm run build` - Compile TypeScript
- `npm test` - Run tests (vitest)

## Style Guidelines

- Never use emojis in output or code. Use plain text characters: `[x]`, `[ ]`, `->`, `*`, etc.
