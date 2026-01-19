# roto-rooter

Static analysis and functional verifier tool for React Router applications.

## Installation

```bash
npm install -g roto-rooter
```

## Usage

```bash
# Check all files in current directory
rr

# Check specific file(s)
rr app/routes/employees.tsx

# Run specific checks only
rr --check links,forms

# Output as JSON
rr --format json

# Set app directory
rr --app ./my-app

# Automatically fix issues where possible
rr --fix

# Preview fixes without applying
rr --dry-run

# Fix specific file(s)
rr --fix app/routes/dashboard.tsx
```

## Checks

- **links**: Validates `<Link>`, `redirect()`, and `navigate()` targets exist as defined routes. Suggests closest matching route when a typo is detected. Auto-fixable when a close match exists.
- **forms**: Validates `<Form>` components submit to routes with action exports, and that form fields match what the action reads via `formData.get()`. Supports intent-based dispatch patterns. Auto-fixable when targeting a mistyped route.
- **loader**: Validates `useLoaderData()` is only used in routes that export a loader function.
- **params**: Validates `useParams()` accesses only params defined in the route path (e.g., `:id` in `/users/:id`).
- **hydration**: Detects SSR hydration mismatch risks:
  - Date/time operations without consistent timezone handling
  - Locale-dependent formatting (e.g., `toLocaleString()`) without explicit `timeZone` option
  - Random value generation during render (`Math.random()`, `uuid()`, `nanoid()`)
  - Browser-only API access outside `useEffect` (`window`, `document`, `localStorage`)

  Some hydration issues are auto-fixable (e.g., adding `{ timeZone: "UTC" }` to locale methods, replacing `uuid()` with `useId()`).

## Programmatic API

```typescript
import { analyze, applyFixes } from 'roto-rooter';

// Run analysis
const result = analyze({
  root: './my-app',
  files: [], // empty = all files
  checks: [], // empty = all checks
  format: 'text',
});

console.log(result.issues);

// Apply auto-fixes
const fixResult = applyFixes(result.issues);
console.log(`Fixed ${fixResult.fixesApplied} issues`);
```

## Development

```bash
npm install      # Install dependencies
npm test         # Run tests
npm run build    # Build for distribution
```
