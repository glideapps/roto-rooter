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
   - Add `fix` property to issues when auto-fix is possible (see "Auto-Fix Guidelines" below)

3. **Register** - In `src/analyzer.ts`: import the check, add to `enabledChecks` default list, add invocation block

4. **Tests** - Create `test/<name>-check.test.ts` using vitest. **Always add realistic fixtures** to `test/fixtures/sample-app/app/routes/` and register them in `routes.ts`. Tests should use these fixtures to verify behavior. CLI integration tests in `test/cli.test.ts` cover end-to-end behavior.

5. **Fix Integration Tests** - If the check generates auto-fixes, add end-to-end tests in `test/fix-integration.test.ts` that verify:
   - Issue is detected with a fix
   - `applyFixes()` modifies files correctly
   - Re-running `analyze()` shows the issue is resolved
   - See existing tests in `fix-integration.test.ts` for the pattern

6. **Parser** (if needed) - Extend `component-parser.ts`, `route-parser.ts`, or `action-parser.ts` for new AST patterns

7. **Documentation** - Update `README.md` and `CLAUDE.md` to list the new check

8. **Verify** - Run `npm test`

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

## Auto-Fix Guidelines

When an issue has a deterministic fix that won't introduce other problems, add an auto-fix:

1. **Track source spans** - In the parser, capture `SourceSpan` for any values that might need fixing (attribute values, identifiers, etc.) using `getNodeSpan()` from `ast-utils.ts`

2. **Create fix edits** - In the check, when a fix is possible:

   ```typescript
   if (suggestion && attributeSpan) {
     issue.fix = {
       description: `Replaced "${badValue}" with "${suggestion}"`,
       edits: [
         {
           file: attributeSpan.file,
           start: attributeSpan.start,
           end: attributeSpan.end,
           newText: `"${suggestion}"`,
         },
       ],
     };
   }
   ```

3. **Fixable vs unfixable** - Only auto-fix when:
   - The fix is deterministic (e.g., typo correction with fuzzy match)
   - No business logic is required (don't auto-generate loaders/actions)
   - The fix won't break other code (be conservative)

4. **Test the fix** - Add integration tests in `test/fix-integration.test.ts` that verify the complete cycle

## Test Fixture Requirements

Every check must have realistic test fixtures that demonstrate both positive and negative cases:

1. **Create fixture file** - Add a `.tsx` file to `test/fixtures/sample-app/app/routes/` that contains:
   - Real-world patterns the check should catch (positive cases)
   - Valid patterns the check should NOT flag (negative cases / false positive prevention)

2. **Register the route** - Add the fixture to `test/fixtures/sample-app/app/routes.ts`

3. **Update route count** - Update the route count in `test/route-parser.test.ts`

4. **Write fixture-based tests** - Tests should:
   - Parse the fixture using `parseComponent()`
   - Run the check against it
   - Verify both that issues ARE found for problematic patterns AND that issues are NOT found for valid patterns

Example fixtures:

- `query-links.tsx` - Links with query strings and hash fragments (should not flag)
- `intent-dispatch.tsx` - Forms with intent-based dispatch (should validate per-intent)
- `server-dates.tsx` - Date operations in loader/action only (should not flag hydration)
- `hydration-issues.tsx` - Real hydration risks (should flag)
- `hydration-safe.tsx` - Safe hydration patterns (should not flag)

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
