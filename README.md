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

# Run all checks (including optional ones)
rr --check all

# Run default checks plus specific optional checks
rr --check defaults,forms

# Output as JSON
rr --format json

# Set project root (the directory containing the app/ folder)
rr --root ./my-app

# Automatically fix issues where possible
rr --fix

# Preview fixes without applying
rr --dry-run

# Fix specific file(s)
rr --fix app/routes/dashboard.tsx

# Enable Drizzle ORM persistence checking (auto-discovers schema)
rr --check drizzle

# Drizzle checking with explicit schema path
rr --check drizzle --drizzle-schema src/db/schema.ts

# Extract SQL queries from Drizzle ORM code
rr sql --drizzle

# Extract queries from a specific file
rr sql --drizzle app/routes/users.tsx

# SQL output as JSON
rr sql --drizzle --format json
```

## Checks

**Default checks** (run automatically):

- **links**: Validates `<Link>`, `redirect()`, and `navigate()` targets exist as defined routes. Suggests closest matching route when a typo is detected. Auto-fixable when a close match exists.
- **loader**: Validates `useLoaderData()` is only used in routes that export a loader function. Detects `clientLoader`/`clientAction` that import server-only modules (database drivers, `fs`, etc.) which will fail in the browser. Auto-fixable by renaming to `loader`/`action`.
- **params**: Validates `useParams()` accesses only params defined in the route path (e.g., `:id` in `/users/:id`).
- **interactivity**: Detects disconnected interactive elements:
  - Dialog/modal forms where "Save" button only closes the dialog without persisting data
  - "Delete" confirmation buttons that only close without performing the action
  - Buttons with empty or stub onClick handlers (console.log only)
  - Validates dialogs use React Router `<Form>` or `useFetcher.submit()` for data operations

**Optional checks** (opt-in via `--check`):

- **forms**: Validates `<Form>` components submit to routes with action exports, and that form fields match what the action reads via `formData.get()`. Supports intent-based dispatch patterns. Auto-fixable when targeting a mistyped route.
- **hydration**: Detects SSR hydration mismatch risks:
  - Date/time operations without consistent timezone handling
  - Locale-dependent formatting (e.g., `toLocaleString()`) without explicit `timeZone` option
  - Random value generation during render (`Math.random()`, `uuid()`, `nanoid()`)
  - Browser-only API access outside `useEffect` (`window`, `document`, `localStorage`)

  Some hydration issues are auto-fixable (e.g., adding `{ timeZone: "UTC" }` to locale methods, replacing `uuid()` with `useId()`).

- **drizzle** (persistence): Validates database operations against Drizzle ORM schema. Auto-discovers schema from common locations (`db/schema.ts`, `src/db/schema.ts`, etc.) or use `--drizzle-schema` for custom paths.
  - Unknown table or column references in `db.insert()`, `db.update()`, `db.delete()`
  - Missing required columns on `db.insert()` calls
  - Null literal assigned to `notNull` column (insert or update)
  - Invalid enum literal values (checked against schema-defined allowed values)
  - Type mismatches: string from `formData.get()` to integer, boolean, timestamp, or json column
  - Writing to auto-generated columns (e.g., serial, auto-increment) on insert
  - `DELETE` or `UPDATE` without `.where()` clause (affects all rows)
  - Enum columns receiving unvalidated external input

## SQL Query Extraction

The `rr sql` command extracts database queries from ORM code and generates equivalent SQL statements.

```bash
rr sql --drizzle                          # extract all SQL queries
rr sql --drizzle app/routes/users.tsx     # extract from specific file
rr sql --drizzle --format json            # JSON output
rr sql --drizzle --drizzle-schema db/schema.ts  # explicit schema path
```

Supports SELECT, INSERT, UPDATE, and DELETE patterns with parameterized queries and column type inference from the schema.

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
