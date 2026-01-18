# Roto-Rooter

Static analysis and functional verifier tool for React Router applications. CLI is `rr`.

## Project Structure

- `src/cli.ts` - CLI entry point
- `src/analyzer.ts` - Main analysis orchestration
- `src/parsers/` - AST parsers for routes, components, and actions
- `src/checks/` - Individual check implementations (links, forms, loader, params, hydration)
- `src/types.ts` - Type definitions
- `scripts/build.mjs` - esbuild bundler (bundles CLI + dependencies into single file)
- `test/cli.test.ts` - CLI integration tests (runs built artifact)

## Commands

- `npm run build` - Bundle with esbuild (outputs to `dist/`)
- `npm test` - Run tests (vitest)

## Testing

- Unit tests: `test/<name>-check.test.ts` for each check
- CLI tests: `test/cli.test.ts` runs the built `dist/cli.js` as a subprocess
- CLI tests verify: build succeeds, version output, help output, file analysis, JSON format

## Style Guidelines

- Never use emojis in output or code. Use plain text characters: `[x]`, `[ ]`, `->`, `*`, etc.
