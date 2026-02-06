---
name: roto-rooter
description: Static analysis for React Router applications. Use when building or debugging React Router apps to verify routes, links, forms, loaders, params, hydration patterns, and database persistence operations.
allowed-tools: Bash(rr:*)
---

# React Router Static Analysis with roto-rooter

## Quick start

```bash
rr                              # analyze all routes in current directory
rr app/routes/dashboard.tsx     # analyze specific file
rr --fix                        # auto-fix issues
rr --dry-run                    # preview fixes
```

Example output:

```
[links] app/routes/dashboard.tsx:24:8
  <Link to="/users">
  [error] Link target "/users" does not match any route

[hydration] app/routes/dashboard.tsx:31:12
  {new Date().toLocaleString()}
  [warning] new Date() in render may cause hydration mismatch
  -> Move to useEffect or use suppressHydrationWarning

1 error, 1 warning
```

## Commands

```bash
rr [FILES...]                   # analyze files (default: all routes)
rr --check links,forms          # run specific checks
rr --check all                  # run all checks (including optional)
rr --check defaults,forms       # run default checks plus specific optional checks
rr --format json                # JSON output
rr --root ./my-app              # set project root
rr sql --drizzle                # extract SQL queries from Drizzle ORM code
rr sql --drizzle --format json  # SQL extraction with JSON output
```

## Available checks

**Default checks** (run automatically):

- **links** - validates Link/NavLink href targets exist as routes
- **loader** - detects loader data usage issues and `clientLoader`/`clientAction` with server-only imports
- **params** - validates route params match definitions
- **interactivity** - detects disconnected dialogs (Save buttons that don't save, stub handlers)

**Optional checks** (opt-in via `--check`):

- **forms** - validates Form action targets and method/action mismatches
- **hydration** - detects hydration mismatches (Date, Math.random, window access in render)
- **drizzle** - validates database operations against Drizzle ORM schema (unknown tables/columns, missing required columns, null-to-notNull, invalid enum literals, type mismatches, auto-generated column writes, DELETE/UPDATE without WHERE)

## Examples

```bash
# Check for broken links in a route file
rr app/routes/dashboard.tsx --check links

# Auto-fix all fixable issues in the project
rr --fix

# Get JSON output for CI integration
rr --format json

# Enable Drizzle ORM persistence checking (auto-discovers schema)
rr --check drizzle

# Drizzle checking with explicit schema path
rr --check drizzle --drizzle-schema src/db/schema.ts

# Extract SQL queries from Drizzle ORM code
rr sql --drizzle

# Extract SQL queries from a specific file
rr sql --drizzle app/routes/users.tsx

# SQL extraction with JSON output
rr sql --drizzle --format json
```
