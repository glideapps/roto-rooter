---
name: add-check
description: Add a new static analysis check to roto-rooter. Use when the user wants to create a new check, validation rule, or analyzer for React Router applications. Guides implementation of checks that require cross-file application context like route/component relationships.
---

# Add Check Skill

Add a new check to roto-rooter: `/add-check <check-name>`

## Scope

**Only add checks that require cross-file application context.** This tool analyzes route/component relationships that ESLint cannot see.

**Add** checks that: cross-reference routes, components, and exports; validate references match actual application structure; require multi-file AST analysis.

**Reject** checks that: can be an ESLint rule; examine single files in isolation; check generic React/TypeScript patterns. If rejectable, explain why and recommend the appropriate ESLint rule instead.

## Implementation Steps

1. **Types** - Add category to `AnalyzerIssue.category` union in `src/types.ts`

2. **Check file** - Create `src/checks/<name>-check.ts`:
   - Export `check<PascalName>(components: ComponentAnalysis[], routes?: RouteDefinition[], rootDir?: string): AnalyzerIssue[]`
   - Use `findBestMatch()` from `../utils/suggestion.js` for typo suggestions

3. **Register** - In `src/analyzer.ts`: import the check, add to `enabledChecks` default list, add invocation block

4. **Tests** - Create `test/<name>-check.test.ts` using vitest; add fixtures to `test/fixtures/sample-app/` if needed

5. **Parser** (if needed) - Extend `component-parser.ts`, `route-parser.ts`, or `action-parser.ts` for new AST patterns

6. **Verify** - Run `npm run test:run`

## Issue Guidelines

- `error` = runtime failure; `warning` = potential problem
- Messages: specific, actionable, include the problematic value
- Always include accurate location (line/column) and code snippet

## Existing Checks

| Category    | File                   | Validates                                           |
| ----------- | ---------------------- | --------------------------------------------------- |
| links       | `link-check.ts`        | `<Link>`, `<a>`, `redirect()`, `navigate()` targets |
| forms       | `form-check.ts`        | `<Form>` actions have corresponding exports         |
| loader      | `loader-check.ts`      | `useLoaderData()`/`useActionData()` usage           |
| params      | `params-check.ts`      | `useParams()` accesses defined route params         |
| interactive | `interactive-check.ts` | (TODO) Button handlers                              |
| a11y        | `a11y-check.ts`        | (TODO) Accessibility                                |
