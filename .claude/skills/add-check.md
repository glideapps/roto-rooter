# Add Check Skill

Add a new check to the react-router-analyzer project.

## Usage

```
/add-check <check-name>
```

Example: `/add-check redirect` to add a redirect check

## Implementation Steps

When adding a new check, follow these steps in order:

### 1. Add the Category to Types

In `src/types.ts`, add the new check category to the `AnalyzerIssue.category` union type:

```typescript
category: "links" | "forms" | "loader" | "params" | "interactive" | "a11y" | "<new-check>";
```

### 2. Create the Check File

Create `src/checks/<check-name>-check.ts` following this exact pattern:

```typescript
import type {
  AnalyzerIssue,
  ComponentAnalysis,
  RouteDefinition,
} from "../types.js";

/**
 * Check <description of what this check validates>
 */
export function check<CheckName>(
  components: ComponentAnalysis[],
  routes?: RouteDefinition[],
  rootDir?: string
): AnalyzerIssue[] {
  const issues: AnalyzerIssue[] = [];

  for (const component of components) {
    // Validation logic here
    // Create issues using this structure:
    // issues.push({
    //   category: "<check-name>",
    //   severity: "error" | "warning",
    //   message: "Human-readable description of the problem",
    //   location: { file: component.file, line: X, column: Y },
    //   code: "the problematic code snippet",
    //   suggestion: "Did you mean: ...?",
    // });
  }

  return issues;
}
```

Key patterns to follow:
- Function name: `check<PascalCaseName>` (e.g., `checkLinks`, `checkForms`, `checkParams`)
- Accept `ComponentAnalysis[]` as first parameter (always required)
- Accept `RouteDefinition[]` as second parameter if the check needs route information
- Accept `rootDir: string` as third parameter if the check needs to read additional files
- Return `AnalyzerIssue[]` - always return an array, even if empty
- Use helper functions for complex validation logic
- Import utilities from `../utils/suggestion.js` for typo suggestions

### 3. Register the Check in Analyzer

In `src/analyzer.ts`:

1. Add the import:
```typescript
import { check<CheckName> } from "./checks/<check-name>-check.js";
```

2. Add to the `enabledChecks` default list (line ~70):
```typescript
const enabledChecks = new Set(
  checks.length > 0 ? checks : ["links", "forms", "loader", "params", "interactive", "a11y", "<check-name>"]
);
```

3. Add the check invocation:
```typescript
if (enabledChecks.has("<check-name>")) {
  issues.push(...check<CheckName>(components, routes, root));
}
```

### 4. Create Test File

Create `test/<check-name>-check.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as path from "path";
import { parseRoutes } from "../src/parsers/route-parser.js";
import { parseComponent } from "../src/parsers/component-parser.js";
import { check<CheckName> } from "../src/checks/<check-name>-check.js";

const fixturesDir = path.join(__dirname, "fixtures/sample-app");

describe("<check-name>-check", () => {
  it("should detect <invalid case>", () => {
    const routes = parseRoutes(fixturesDir);
    const componentPath = path.join(fixturesDir, "app/routes/<component>.tsx");
    const component = parseComponent(componentPath);

    const issues = check<CheckName>([component], routes, fixturesDir);

    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].category).toBe("<check-name>");
    expect(issues[0].severity).toBe("error");
  });

  it("should not flag valid <case>", () => {
    const routes = parseRoutes(fixturesDir);
    const componentPath = path.join(fixturesDir, "app/routes/<valid-component>.tsx");
    const component = parseComponent(componentPath);

    const issues = check<CheckName>([component], routes, fixturesDir);

    expect(issues).toHaveLength(0);
  });
});
```

### 5. Add Test Fixtures (if needed)

If the existing fixtures don't cover your check's scenarios, add new fixture files:

1. Add route to `test/fixtures/sample-app/app/routes.ts`:
```typescript
route("/<path>", "routes/<file>.tsx"),
```

2. Create the component file `test/fixtures/sample-app/app/routes/<file>.tsx` with both valid and invalid cases to test against.

### 6. Update Parser (if needed)

If the check requires parsing new AST patterns, update the appropriate parser:

- **Component references** (JSX elements, hooks): `src/parsers/component-parser.ts`
- **Route definitions**: `src/parsers/route-parser.ts`
- **Route exports** (loader/action detection): `src/parsers/action-parser.ts`

Add new interfaces to `src/types.ts` for any new reference types, following the pattern of `LinkReference`, `FormReference`, etc.

### 7. Run Tests

```bash
npm run test:run
```

Ensure all tests pass, including the new ones.

## Check Design Guidelines

1. **Severity levels**:
   - `error`: Issues that will cause runtime failures
   - `warning`: Issues that may cause problems or are code smell

2. **Messages**: Be specific and actionable. Include the actual problematic value.

3. **Suggestions**: Use `findBestMatch()` from `src/utils/suggestion.js` for typo detection.

4. **Code snippets**: Include the relevant code in the `code` field for context.

5. **Location**: Always provide accurate line/column from the parsed AST.

## Existing Check Reference

| Check | File | Category | Validates |
|-------|------|----------|-----------|
| Links | `link-check.ts` | `links` | `<Link>`, `<a>`, `redirect()`, `navigate()` targets exist |
| Forms | `form-check.ts` | `forms` | `<Form>` actions have corresponding exports |
| Loader | `loader-check.ts` | `loader` | `useLoaderData()`/`useActionData()` usage |
| Params | `params-check.ts` | `params` | `useParams()` accesses defined route params |
| Interactive | `interactive-check.ts` | `interactive` | (TODO) Button handlers exist |
| A11y | `a11y-check.ts` | `a11y` | (TODO) Accessibility issues |
