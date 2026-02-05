# Roto-Rooter

Static analysis and functional verifier tool for React Router applications. CLI is `rr`.

## Project Structure

- `src/cli.ts` - CLI entry point
- `src/analyzer.ts` - Main analysis orchestration
- `src/parsers/` - AST parsers for routes, components, and actions
- `src/checks/` - Individual check implementations (links, forms, loader, params, hydration, interactivity, drizzle/persistence)
- `src/sql/` - SQL query extraction from ORM code (drizzle.ts, drizzle-operations.ts, types.ts)
- `src/sql-extractor.ts` - SQL extraction orchestration and formatting
- `src/types.ts` - Type definitions
- `scripts/build.mjs` - esbuild bundler (bundles CLI + dependencies into single file)
- `test/cli.test.ts` - CLI integration tests (runs built artifact)
- `test/fixtures/sample-app/` - Test fixtures (realistic React Router app)

## Commands

- `npm run build` - Bundle with esbuild (outputs to `dist/`)
- `npm test` - Run tests (vitest)

## Testing

- Unit tests: `test/<name>-check.test.ts` for each check
- CLI tests: `test/cli.test.ts` runs the built `dist/cli.js` as a subprocess
- CLI tests verify: build succeeds, version output, help output, file analysis, JSON format
- Test fixtures: `test/fixtures/sample-app/` contains realistic route files

### Testing Requirements

When fixing false positives or adding new features:

1. **Always add a test fixture** - Create a realistic `.tsx` file in `test/fixtures/sample-app/app/routes/` that demonstrates the pattern
2. **Add the route** - Register new fixtures in `test/fixtures/sample-app/app/routes.ts`
3. **Write tests against the fixture** - Tests should parse the fixture and verify the expected behavior
4. **Test both positive and negative cases** - Ensure the check catches real issues AND doesn't flag valid patterns

Example fixture patterns:

- `intent-dispatch.tsx` - Forms with intent-based dispatch (multiple forms, different intents)
- `server-dates.tsx` - Date operations in loader/action (should not flag hydration issues)
- `hydration-safe.tsx` - Safe hydration patterns (useEffect, suppressHydrationWarning, explicit timezone)
- `hydration-issues.tsx` - Real hydration issues (new Date() in render, Math.random(), window access)

## Style Guidelines

- Never use emojis in output or code. Use plain text characters: `[x]`, `[ ]`, `->`, `*`, etc.
