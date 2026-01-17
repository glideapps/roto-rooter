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

6. **Documentation** - Update `README.md` and `CLAUDE.md` to list the new check

7. **Verify** - Run `npm test`

## Summary Output

After implementing the check, output a summary that includes example CLI output showing what the check failure looks like:

```
## Check Implementation Complete: <check-name>

### Files Changed
- src/types.ts - Added '<check-name>' to category union
- src/checks/<check-name>-check.ts - New check implementation
- src/analyzer.ts - Registered check
- test/<check-name>-check.test.ts - Tests
- README.md, CLAUDE.md - Documentation

### Example Output
$ rr app/routes/example.tsx
app/routes/example.tsx:15:5 error [<check-name>] <Error message here>
  |
  | <code snippet showing the problematic line>
  |
  Suggestion: <suggestion text>

Found 1 issue (1 error, 0 warnings)
```

## Issue Guidelines

### Severity Levels

**`error`** - Use for issues that will:

- Cause render failures or runtime exceptions
- Result in inconsistent behavior across users (e.g., different locales, timezones, browsers)
- Break functionality in ways users will notice (missing data, broken navigation, form failures)
- Cause hydration mismatches that force React to discard and re-render

**`warning`** - Use for issues that:

- Log errors to the browser console but don't affect user-visible behavior
- Have a less efficient but functional fallback (e.g., performance degradation)
- May cause problems only in edge cases or specific configurations
- Are best practices violations that don't directly impact users

When in doubt, prefer `error`. Users can configure checks to ignore specific issues, but they can't escalate warnings they missed.

### Message Format

- Messages: specific, actionable, include the problematic value
- Always include accurate location (line/column) and code snippet

## Existing Checks

| Category  | File                 | Validates                                                  |
| --------- | -------------------- | ---------------------------------------------------------- |
| links     | `link-check.ts`      | `<Link>`, `<a>`, `redirect()`, `navigate()` targets        |
| forms     | `form-check.ts`      | `<Form>` actions + field/formData.get() alignment          |
| loader    | `loader-check.ts`    | `useLoaderData()`/`useActionData()` usage                  |
| params    | `params-check.ts`    | `useParams()` accesses defined route params                |
| hydration | `hydration-check.ts` | SSR hydration mismatch risks (dates, locale, browser APIs) |
